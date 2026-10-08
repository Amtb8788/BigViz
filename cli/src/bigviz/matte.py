"""Background removal and clean-up for mockup crops and AI renders.

- `unscreen`: glow art baked onto a dark (possibly gradient) background.
  alpha grows with how far a pixel is above the background; colour is
  solved from C = F*a + B*(1-a).
- `black_to_alpha`: renders on pure black (AI regen), un-premultiplied.
- `grabcut`: solid objects (medals, trophies) seeded by colour or a rect.
- `erase_text`: inpaint baked-in text (TELEA) + horizontal interpolation.
- `trim` / `margins` / `fit`: bbox crop, trim ratios, resize.

Every function accepts a PIL image or an array and returns a PIL image.
"""

from __future__ import annotations

from typing import Callable, Sequence

import cv2
import numpy as np
from PIL import Image

Box = Sequence[int]  # x, y, w, h


def _rgb(img: Image.Image | np.ndarray) -> np.ndarray:
    if isinstance(img, np.ndarray):
        return img[..., :3].astype(np.uint8) if img.ndim == 3 else np.dstack([img] * 3).astype(np.uint8)
    return np.asarray(img.convert("RGB"))


def _rgba_image(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    """rgb float 0-255, alpha float 0-1 -> RGBA image."""
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 1) * 255])
    return Image.fromarray(out.round().astype(np.uint8), "RGBA")


def smoothstep(m: np.ndarray) -> np.ndarray:
    m = np.clip(m, 0, 1)
    return m * m * (3 - 2 * m)


def rect_mask(h: int, w: int, feather: float = 0.22) -> np.ndarray:
    """Fade the crop edges; `feather` = fraction of the short side faded at each edge."""
    f = max(2.0, feather * min(h, w))
    ys = np.minimum(np.arange(h), np.arange(h)[::-1]) / f
    xs = np.minimum(np.arange(w), np.arange(w)[::-1]) / f
    return smoothstep(np.minimum.outer(ys, xs))


def ellipse_mask(h: int, w: int, inner: float = 0.72) -> np.ndarray:
    """Radial fade for round art: 1 inside `inner` radius, 0 at the inscribed ellipse."""
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - (w - 1) / 2) / (w / 2), (yy - (h - 1) / 2) / (h / 2))
    return smoothstep((1 - r) / max(1e-6, 1 - inner))


def estimate_bg(rgb: np.ndarray, ring: int = 2, pct: float = 60) -> np.ndarray:
    """Flat background colour: a darkish percentile of the border ring."""
    r = max(1, ring)
    border = np.concatenate([rgb[:r].reshape(-1, 3), rgb[-r:].reshape(-1, 3),
                             rgb[:, :r].reshape(-1, 3), rgb[:, -r:].reshape(-1, 3)])
    return np.percentile(border.astype(np.float32), pct, axis=0)


def row_background(rgb: np.ndarray, strip: int = 40, inset: int = 4, pct: float = 25,
                   sigma: float = 9) -> np.ndarray:
    """Per-row background for vertical gradients, sampled from both side strips.

    Returns shape (h, 1, 3) so it broadcasts over columns.
    """
    w = rgb.shape[1]
    strip = max(1, min(strip, (w - 2 * inset) // 2))
    inset = min(inset, max(0, w // 2 - strip))
    left = rgb[:, inset:inset + strip]
    right = rgb[:, w - inset - strip:w - inset]
    sides = np.concatenate([left, right], axis=1)
    bg = np.percentile(sides.astype(np.float32), pct, axis=1)  # (h, 3)
    if sigma > 0:
        bg = cv2.GaussianBlur(bg[:, None, :], (1, 0), sigmaX=0, sigmaY=sigma)[:, 0, :]
    return bg[:, None, :]


def noise_gate(alpha: np.ndarray, lo: float = 0.06, width: float = 0.14,
               solid: float = 0.3, close: int = 121, blur: float = 6) -> np.ndarray:
    """Fade faint haze (alpha < lo + width) unless it sits inside/near solid structure."""
    knee = smoothstep((alpha - lo) / max(1e-6, width))
    solid_m = (alpha > solid).astype(np.float32)
    if close > 1:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close))
        solid_m = cv2.morphologyEx(solid_m, cv2.MORPH_CLOSE, k)
    protect = cv2.GaussianBlur(solid_m, (0, 0), blur) if blur > 0 else solid_m
    return alpha * (knee + (1 - knee) * protect)


def unscreen(img, bg=None, gain: float = 1.4, bias: float = 0.04, offset: float = 0.0,
             feather_rect: float | None = None, feather_ellipse: float | None = None,
             gate: dict | bool | None = None) -> Image.Image:
    """Recover RGBA from glow art on a dark background.

    bg: None = border-ring estimate, 'rows' = per-row side-strip estimate,
        or an explicit (r, g, b) colour.
    alpha = clip(max_c((C - B - offset) / (255 - B)) * gain - bias).
    gate: True or kwargs for `noise_gate` (drop faint haze, keep framed glass).
    """
    rgb = _rgb(img).astype(np.float32)
    if bg is None:
        b = estimate_bg(rgb).reshape(1, 1, 3)
    elif isinstance(bg, str):
        if bg != "rows":
            raise ValueError(f"bg must be None, 'rows' or an RGB colour, got '{bg}'")
        b = row_background(rgb)
    else:
        b = np.asarray(bg, np.float32).reshape(1, 1, 3)
    diff = np.clip(rgb - b - offset, 0, None) / np.maximum(255 - b, 1)
    alpha = np.clip(diff.max(axis=2) * gain - bias, 0, 1)
    if gate:
        alpha = noise_gate(alpha, **(gate if isinstance(gate, dict) else {}))
    h, w = alpha.shape
    if feather_ellipse:
        alpha = alpha * ellipse_mask(h, w, feather_ellipse)
    if feather_rect:
        alpha = alpha * rect_mask(h, w, feather_rect)
    a = np.maximum(alpha[..., None], 1e-3)
    fg = (rgb - b * (1 - a)) / a
    return _rgba_image(fg, alpha)


def black_to_alpha(img, floor: float = 0.06, gain: float = 1.25) -> Image.Image:
    """Key out a pure-black background; colour is un-premultiplied to keep glow hue."""
    rgb = _rgb(img).astype(np.float32) / 255
    alpha = np.clip((rgb.max(axis=2) - floor) / (1 - floor) * gain, 0, 1)
    a = np.maximum(alpha[..., None], 1e-3)
    fg = np.clip(rgb / a, 0, 1)
    return _rgba_image(fg * 255, alpha)


# --------------------------------------------------------------------------- grabcut


def seed_warm(rgb: np.ndarray) -> np.ndarray:
    """Gold / bronze metal: red clearly above blue."""
    c = rgb.astype(np.int16)
    return (c[..., 0] - c[..., 2] > 40) & (c.mean(2) > 70)


def seed_neutral(rgb: np.ndarray) -> np.ndarray:
    """Silver / white metal: bright, low blue cast."""
    c = rgb.astype(np.int16)
    return (c[..., 2] - c[..., 0] < 60) & (c.mean(2) > 120)


def seed_bright(rgb: np.ndarray) -> np.ndarray:
    """Anything clearly brighter than the crop's median (generic default)."""
    lum = rgb.astype(np.float32).mean(2)
    return lum > max(60.0, float(np.median(lum)) + 40)


SEEDS: dict[str, Callable[[np.ndarray], np.ndarray]] = {
    "warm": seed_warm, "neutral": seed_neutral, "bright": seed_bright,
}


def _keep_components(mask: np.ndarray, min_area: int) -> np.ndarray:
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    keep = np.zeros(mask.shape, np.uint8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            keep[lab == i] = 1
    return keep


def grabcut(img, seed_fn: Callable | str | None = None, rect: Box | None = None,
            iters: int = 6, min_area: int = 150, soften: float = 0.8) -> Image.Image:
    """Cut a solid object. Seed with a colour function (or name in SEEDS) or a rect (x, y, w, h).

    With neither, the generic `bright` seed is used. The crop border is always background.
    """
    rgb = np.ascontiguousarray(_rgb(img))
    h, w = rgb.shape[:2]
    gc = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    if isinstance(seed_fn, str):
        if seed_fn not in SEEDS:
            raise ValueError(f"unknown seed '{seed_fn}' (choose {', '.join(SEEDS)})")
        seed_fn = SEEDS[seed_fn]
    if rect is not None:
        x, y, rw, rh = (int(v) for v in rect)
        gc[:] = cv2.GC_BGD
        gc[y:y + rh, x:x + rw] = cv2.GC_PR_FGD
    else:
        seed = (seed_fn or seed_bright)(rgb).astype(bool)
        if not seed.any():
            return _rgba_image(rgb.astype(np.float32), np.zeros((h, w), np.float32))
        gc[seed] = cv2.GC_PR_FGD
        core = cv2.erode(seed.astype(np.uint8), np.ones((5, 5), np.uint8))
        gc[core > 0] = cv2.GC_FGD
    b = max(1, min(3, h // 10, w // 10))
    gc[:b, :] = gc[-b:, :] = gc[:, :b] = gc[:, -b:] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(rgb, gc, None, bgd, fgd, iters, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        pass  # degenerate input (e.g. no background samples): keep the seed mask
    fg = np.isin(gc, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8)
    keep = _keep_components(fg, min_area)
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    alpha = keep.astype(np.float32)
    if soften > 0:
        alpha = cv2.GaussianBlur(alpha, (0, 0), soften)
    return _rgba_image(rgb.astype(np.float32), alpha)


# --------------------------------------------------------------------------- text erase


def text_mask(rgb: np.ndarray, boxes: list[Box], mode: str = "bright", thresh: float = 95,
              dilate: int = 7) -> np.ndarray:
    """Glyph mask inside `boxes`. mode 'bright' = pixels above `thresh` luminance, 'all' = whole box."""
    h, w = rgb.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    lum = rgb.astype(np.float32).mean(2)
    for x, y, bw, bh in boxes:
        sl = (slice(max(0, y), min(h, y + bh)), slice(max(0, x), min(w, x + bw)))
        mask[sl] = 255 if mode == "all" else np.where(lum[sl] > thresh, 255, 0)
    if dilate > 1:
        mask = cv2.dilate(mask, np.ones((dilate, dilate), np.uint8), iterations=2)
    return mask


def erase_text(img, boxes: list[Box], mode: str = "bright", thresh: float = 95,
               radius: int = 9, interp: float = 1.6) -> Image.Image:
    """Remove baked-in text: TELEA inpaint, then refill each box by interpolating
    horizontally between the clean columns on either side, blended through a
    feathered glyph mask (TELEA alone leaves blotchy residue on gradients/glass)."""
    src = img.convert("RGBA") if isinstance(img, Image.Image) else None
    rgb = np.ascontiguousarray(_rgb(img))
    h, w = rgb.shape[:2]
    mask = text_mask(rgb, boxes, mode, thresh)
    clean = cv2.inpaint(rgb, mask, radius, cv2.INPAINT_TELEA).astype(np.float32)
    for x, y, bw, bh in boxes:
        x0, y0, x1, y1 = max(0, x), max(0, y), min(w, x + bw), min(h, y + bh)
        if x1 - x0 < 2 or y1 - y0 < 1:
            continue
        lx = slice(max(0, x0 - 8), max(1, x0 - 2)) if x0 >= 3 else slice(x0, x0 + 1)
        rx = slice(min(w - 1, x1 + 2), min(w, x1 + 8)) if x1 + 3 <= w else slice(x1 - 1, x1)
        left = clean[y0:y1, lx].mean(axis=1)
        right = clean[y0:y1, rx].mean(axis=1)
        t = np.linspace(0, 1, x1 - x0)[None, :, None]
        fill = cv2.GaussianBlur(left[:, None] * (1 - t) + right[:, None] * t, (0, 0), 4)
        m = cv2.GaussianBlur(mask[y0:y1, x0:x1].astype(np.float32) / 255, (0, 0), 5)
        m = np.clip(m * interp, 0, 1)[..., None]
        clean[y0:y1, x0:x1] = clean[y0:y1, x0:x1] * (1 - m) + fill * m
    out = Image.fromarray(np.clip(clean, 0, 255).round().astype(np.uint8), "RGB")
    if src is not None and src.mode == "RGBA" and img.mode == "RGBA":
        out.putalpha(src.getchannel("A"))
    return out


# --------------------------------------------------------------------------- trim / fit


def margins(img: Image.Image, alpha_threshold: int = 8) -> tuple[tuple[int, int, int, int] | None, dict]:
    """bbox (l, t, r, b) of pixels with alpha > threshold, and the transparent margin
    ratios {l, t, r, b} as fractions of width / height."""
    a = np.asarray(img.convert("RGBA").getchannel("A")) > alpha_threshold
    h, w = a.shape
    if not a.any():
        return None, {"l": 0.0, "t": 0.0, "r": 0.0, "b": 0.0}
    cols, rows = np.where(a.any(axis=0))[0], np.where(a.any(axis=1))[0]
    l, r, t, b = int(cols[0]), int(cols[-1]) + 1, int(rows[0]), int(rows[-1]) + 1
    ratios = {"l": round(l / w, 4), "t": round(t / h, 4),
              "r": round((w - r) / w, 4), "b": round((h - b) / h, 4)}
    return (l, t, r, b), ratios


def trim(img: Image.Image, alpha_threshold: int = 8) -> tuple[Image.Image, tuple | None, dict]:
    """Crop to the alpha bbox. Returns (cropped, bbox, trim ratios of the original)."""
    bbox, ratios = margins(img, alpha_threshold)
    return (img.crop(bbox) if bbox else img), bbox, ratios


def fit(img: Image.Image, longest_edge: int, upscale: bool = False) -> Image.Image:
    """Resize so the longest edge is `longest_edge` (downscale only unless `upscale`)."""
    s = longest_edge / max(img.size)
    if s >= 1 and not upscale:
        return img
    size = (max(1, round(img.width * s)), max(1, round(img.height * s)))
    return img.resize(size, Image.LANCZOS)


def on_background(img: Image.Image, colour=(0, 0, 0)) -> Image.Image:
    """Composite RGBA onto a solid colour (used for regen references and previews)."""
    rgba = img.convert("RGBA")
    bg = Image.new("RGBA", rgba.size, (*colour, 255))
    bg.alpha_composite(rgba)
    return bg.convert("RGB")
