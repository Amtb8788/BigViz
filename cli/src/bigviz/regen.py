"""AI HD regeneration of assets.

Per asset: reference (alpha or placeholder, composited on black, fitted to
1024) -> image edit with the regen prompt -> black matte -> trim -> fit to
`target` -> `assets/final/<id>.png`. Assets with `regen: false` skip the API:
final = matted alpha, trimmed and resized. Assets run in a thread pool.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable

from PIL import Image

from bigviz import matte as M
from bigviz.log import output_paths, safe_name, write_sidecar
from bigviz.prompts import regen_prompt
from bigviz.slice import _final_image, crop_box, upscale
from bigviz.spec import Spec

REF_EDGE = 1024


def pick_size(w: int, h: int) -> str:
    """Closest standard gpt-image size for the asset aspect."""
    r = w / h
    if r >= 1.25:
        return "1536x1024"
    if r <= 0.8:
        return "1024x1536"
    return "1024x1024"


def source_image(spec: Spec, asset: dict) -> Image.Image:
    """Best available source: matted alpha, then placeholder, then a fresh crop."""
    for sub in ("assets/alpha", "assets/placeholder"):
        p = spec.workspace / sub / f"{asset['id']}.png"
        if p.is_file():
            return Image.open(p).convert("RGBA")
    return upscale(crop_box(_final_image(spec), asset["box"])).convert("RGBA")


def make_reference(spec: Spec, asset: dict) -> Path:
    out_dir = spec.dir(f"assets/regen/{asset['id']}")
    ref = M.fit(M.on_background(source_image(spec, asset)), REF_EDGE, upscale=True)
    path = out_dir / "ref.png"
    ref.save(path)
    return path


def finalize(img: Image.Image, target: int, from_black: bool) -> Image.Image:
    """Black matte (for AI renders), trim to content, fit to `target` longest edge."""
    rgba = M.black_to_alpha(img) if from_black else img.convert("RGBA")
    cropped, _, _ = M.trim(rgba)
    return M.fit(cropped, target)


def latest_output(spec: Spec, asset_id: str) -> Path | None:
    d = spec.workspace / "assets" / "regen" / asset_id
    outs = sorted((p for p in d.glob("*.png") if p.name != "ref.png"), key=lambda p: p.stat().st_mtime)
    return outs[-1] if outs else None


def regen_asset(spec: Spec, asset: dict, client=None, *, dry_run: bool = False, reuse: bool = False,
                quality: str = "high", model: str | None = None) -> dict:
    """Process one asset; returns {id, status, final?, output?}."""
    aid, final_dir = asset["id"], spec.dir("assets/final")
    final_path = final_dir / f"{aid}.png"
    if not asset["regen"]:
        finalize(source_image(spec, asset), asset["target"], from_black=False).save(final_path, optimize=True)
        return {"id": aid, "status": "copied", "final": str(final_path)}
    cfg = asset["regen"]
    prompt = regen_prompt(cfg["subject"], cfg["fill"])
    out_dir = spec.dir(f"assets/regen/{aid}")
    prompt_file = out_dir / "prompt.txt"
    prompt_file.write_text(prompt, encoding="utf-8")
    output = latest_output(spec, aid) if reuse else None
    if output is None:
        ref = make_reference(spec, asset)
        if dry_run:
            return {"id": aid, "status": "dry-run", "ref": str(ref), "prompt": str(prompt_file)}
        if client is None:
            raise RuntimeError("regen needs an image client (set BIGVIZ_API_KEY)")
        with Image.open(ref) as im:
            size = pick_size(*im.size)
        model = model or client.config.model
        res = client.edit(prompt, [ref], model=model, size=size, quality=quality, n=1)[0]
        output = output_paths(out_dir, f"{aid}-{safe_name(model)}", 1)[0]
        output.write_bytes(res.data)
        write_sidecar(output, prompt_file=prompt_file, prompt_text=prompt, model=model,
                      size_requested=size, size_actual=res.size, quality=quality, refs=[ref], kind="regen")
    with Image.open(output) as im:
        finalize(im, asset["target"], from_black=True).save(final_path, optimize=True)
    return {"id": aid, "status": "regenerated", "output": str(output), "final": str(final_path)}


def regen_all(spec: Spec, ids: list[str] | None = None, client=None, jobs: int = 3,
              on_done: Callable[[dict], None] | None = None, **kw) -> list[dict]:
    """Run `regen_asset` over the selection with `jobs` worker threads; errors are captured."""
    assets = spec.select_assets(ids)
    results: list[dict] = []
    pool = ThreadPoolExecutor(max_workers=max(1, jobs))
    try:
        futures = {pool.submit(regen_asset, spec, a, client, **kw): a["id"] for a in assets}
        for fut in as_completed(futures):
            try:
                r = fut.result()
            except Exception as exc:  # noqa: BLE001 - report per asset, keep going
                r = {"id": futures[fut], "status": "error", "error": str(exc)}
            results.append(r)
            if on_done:
                try:
                    on_done(r)
                except Exception:  # noqa: BLE001 - a reporting callback must not lose results
                    pass
    except BaseException:
        # Ctrl+C: drop queued (billable) API calls instead of finishing them
        pool.shutdown(wait=False, cancel_futures=True)
        raise
    pool.shutdown(wait=True)
    order = {a["id"]: i for i, a in enumerate(assets)}
    return sorted(results, key=lambda r: order[r["id"]])
