"""Labelled contact sheets and screenshot-vs-mockup overlays.

`contact_sheet`: grid of images with file-name labels, for style shoot-outs,
asset review and motion frames. `overlay`: alpha blend of a screenshot over
its mockup, plus an optional abs-diff heatmap with a mean-difference score.
"""

from __future__ import annotations

import glob as globlib
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageColor, ImageDraw, ImageFont

LABEL_H = 28
GAP = 12


def expand(patterns: list[str] | str) -> list[Path]:
    """Expand glob patterns (or plain paths) into a sorted, de-duplicated file list."""
    pats = [patterns] if isinstance(patterns, str) else patterns
    seen: dict[str, Path] = {}
    for pat in pats:
        hits = globlib.glob(pat, recursive=True) or ([pat] if Path(pat).is_file() else [])
        for h in sorted(hits):
            p = Path(h)
            if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and str(p) not in seen:
                seen[str(p)] = p
    return list(seen.values())


def _font(size: int = 16) -> ImageFont.ImageFont:
    for name in ("arial.ttf", "DejaVuSans.ttf", "Helvetica.ttc"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def contact_sheet(paths: list[Path], cols: int = 4, bg: str = "#081E56", cell: int = 480,
                  labels: list[str] | None = None) -> Image.Image:
    """Grid of thumbnails (longest edge `cell`) with a label under each."""
    if not paths:
        raise ValueError("contact sheet needs at least one image")
    cols = max(1, min(cols, len(paths)))
    rows = -(-len(paths) // cols)
    thumbs = []
    for p in paths:
        with Image.open(p) as im:
            im = im.convert("RGBA")
            im.thumbnail((cell, cell), Image.LANCZOS)
            thumbs.append(im.copy())
    cw = max(t.width for t in thumbs)
    ch = max(t.height for t in thumbs)
    W = cols * cw + (cols + 1) * GAP
    H = rows * (ch + LABEL_H) + (rows + 1) * GAP
    colour = ImageColor.getrgb(bg)
    sheet = Image.new("RGBA", (W, H), (*colour[:3], 255))
    draw = ImageDraw.Draw(sheet)
    font = _font()
    for i, (t, p) in enumerate(zip(thumbs, paths)):
        r, c = divmod(i, cols)
        x = GAP + c * (cw + GAP)
        y = GAP + r * (ch + LABEL_H + GAP)
        sheet.alpha_composite(t, (x + (cw - t.width) // 2, y + (ch - t.height) // 2))
        text = labels[i] if labels else Path(p).name
        draw.text((x, y + ch + 6), text[:60], fill=(255, 255, 255, 255), font=font)
    return sheet.convert("RGB")


def overlay(shot: Path, design: Path, alpha: float = 0.5, diff: bool = False
            ) -> tuple[Image.Image, Image.Image | None, float | None]:
    """Blend `shot` over `design` (design resized to the shot). Returns
    (blend, heatmap or None, mean abs difference 0-1 or None)."""
    with Image.open(shot) as a, Image.open(design) as b:
        s = a.convert("RGB")
        d = b.convert("RGB").resize(s.size, Image.LANCZOS)
    blend = Image.blend(d, s, max(0.0, min(1.0, alpha)))
    if not diff:
        return blend, None, None
    sa = np.asarray(s, np.float32)
    da = np.asarray(d, np.float32)
    delta = np.abs(sa - da).mean(axis=2)
    score = float(delta.mean() / 255)
    norm = np.clip(delta * (255.0 / max(1.0, float(np.percentile(delta, 99.5)))), 0, 255).astype(np.uint8)
    heat = cv2.applyColorMap(norm, cv2.COLORMAP_INFERNO)[..., ::-1]
    return blend, Image.fromarray(np.ascontiguousarray(heat)), score
