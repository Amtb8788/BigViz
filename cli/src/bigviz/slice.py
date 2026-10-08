"""Cut assets out of the picked mockup.

`slice_assets`: straight crops of `assets[].box` from `design.final`, upscaled
x2 (LANCZOS) into `assets/placeholder/` so page development can start at once.
`matte_assets`: erase baked-in text, crop, x2, then apply `assets[].matte`
into `assets/alpha/`.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from bigviz import matte as M
from bigviz.spec import Spec, SpecError

SCALE = 2
PAD = 12  # context around a box when inpainting erase boxes


def _final_image(spec: Spec) -> Image.Image:
    path = spec.final_design
    if path is None:
        raise SpecError("spec.design.final: not set (pick a mockup first)")
    if not path.is_file():
        raise SpecError(f"spec.design.final: file not found: {path}")
    return Image.open(path).convert("RGB")


def crop_box(img: Image.Image, box) -> Image.Image:
    x, y, w, h = box
    return img.crop((x, y, x + w, y + h))


def upscale(img: Image.Image, scale: int = SCALE) -> Image.Image:
    return img.resize((img.width * scale, img.height * scale), Image.LANCZOS)


def slice_assets(spec: Spec, ids: list[str] | None = None, scale: int = SCALE) -> list[Path]:
    """Write `assets/placeholder/<id>.png` for every selected asset."""
    src = _final_image(spec)
    out_dir = spec.dir("assets/placeholder")
    written = []
    for a in spec.select_assets(ids):
        out = out_dir / f"{a['id']}.png"
        upscale(crop_box(src, a["box"]), scale).save(out, optimize=True)
        written.append(out)
    return written


def erase_in_crop(src: Image.Image, box, erase_boxes) -> Image.Image:
    """Crop `box` after inpainting `erase_boxes` (design pixels) on a padded region."""
    if not erase_boxes:
        return crop_box(src, box)
    x, y, w, h = box
    px0, py0 = max(0, x - PAD), max(0, y - PAD)
    px1, py1 = min(src.width, x + w + PAD), min(src.height, y + h + PAD)
    region = src.crop((px0, py0, px1, py1))
    local = [(ex - px0, ey - py0, ew, eh) for ex, ey, ew, eh in erase_boxes]
    clean = M.erase_text(region, local)
    return clean.crop((x - px0, y - py0, x - px0 + w, y - py0 + h))


def matte_image(img: Image.Image, method: str, **kw) -> Image.Image:
    """Dispatch one matte method. `kw` passes method options through."""
    if method == "none":
        return img.convert("RGBA")
    if method == "unscreen":
        if "feather_ellipse" not in kw:
            kw.setdefault("feather_rect", 0.22)
        return M.unscreen(img, **kw)
    if method == "black":
        return M.black_to_alpha(img, **kw)
    if method == "grabcut":
        return M.grabcut(img, **kw)
    raise ValueError(f"unknown matte method '{method}'")


def matte_assets(spec: Spec, ids: list[str] | None = None, scale: int = SCALE) -> list[Path]:
    """Write `assets/alpha/<id>.png` using each asset's `matte` and `erase` settings."""
    src = _final_image(spec)
    out_dir = spec.dir("assets/alpha")
    written = []
    for a in spec.select_assets(ids):
        crop = upscale(erase_in_crop(src, a["box"], a["erase"]), scale)
        out = out_dir / f"{a['id']}.png"
        matte_image(crop, a["matte"]).save(out, optimize=True)
        written.append(out)
    return written
