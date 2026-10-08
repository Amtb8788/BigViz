"""Measure every final asset into `assets/final/manifest.json`.

Each entry: id, file, width, height, aspect (w/h) and trim ratios {l, t, r, b}:
the fraction of the width/height that is (nearly) transparent around the
solid body of the art (alpha > `body_threshold`). Pages use the ratios to
align the visual body when an image is laid out with `object-fit: contain`.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from bigviz.matte import margins
from bigviz.spec import Spec

MANIFEST = "manifest.json"
BODY_THRESHOLD = 60


def measure(path: Path, body_threshold: int = BODY_THRESHOLD) -> dict:
    with Image.open(path) as im:
        im.load()
        w, h = im.size
        has_alpha = im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info
        if has_alpha:
            _, ratios = margins(im, body_threshold)
        else:
            ratios = {"l": 0.0, "t": 0.0, "r": 0.0, "b": 0.0}
    return {"id": path.stem, "file": path.name, "width": w, "height": h,
            "aspect": round(w / h, 4), "trim": ratios}


def build_manifest(spec: Spec, body_threshold: int = BODY_THRESHOLD) -> Path:
    """Write `assets/final/manifest.json` (sorted by spec order, then file name)."""
    final_dir = spec.dir("assets/final")
    files = sorted(p for p in final_dir.glob("*.png"))
    order = {a["id"]: i for i, a in enumerate(spec["assets"])}
    files.sort(key=lambda p: (order.get(p.stem, len(order)), p.name))
    uses = {a["id"]: a["use"] for a in spec["assets"]}
    entries = []
    for p in files:
        e = measure(p, body_threshold)
        if uses.get(e["id"]):
            e["use"] = uses[e["id"]]
        entries.append(e)
    data = {"slug": spec.slug, "assets": entries}
    out = final_dir / MANIFEST
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out


def load_manifest(spec: Spec) -> dict:
    p = spec.workspace / "assets" / "final" / MANIFEST
    if not p.is_file():
        raise FileNotFoundError(f"{p} not found (run `bigviz manifest` first)")
    return json.loads(p.read_text(encoding="utf-8"))
