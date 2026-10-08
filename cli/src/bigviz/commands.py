"""Implementations of the `bigviz` sub-commands (argparse namespaces in, exit code out)."""

from __future__ import annotations

import importlib
import json
import os
import platform
import sys
from pathlib import Path

from PIL import Image

from bigviz import matte as M
from bigviz import prompts as P
from bigviz.log import output_paths, safe_name, write_sidecar
from bigviz.spec import Spec, SpecError, find_spec, init_workspace, load_spec, preset_names

PROBE_FILE = ".bigviz-probe.json"


# --------------------------------------------------------------------------- helpers


def _spec(args, check_files: bool = True) -> Spec:
    return load_spec(find_spec(getattr(args, "spec", None)), check_files=check_files)


def _try_spec(args) -> Spec | None:
    try:
        return _spec(args, check_files=False)
    except SpecError:
        if getattr(args, "spec", None):
            raise
        return None


def _json(args) -> bool:
    return bool(getattr(args, "json", False))


def _emit(args, data, text: str | None = None) -> None:
    if _json(args):
        print(json.dumps(data, indent=2, ensure_ascii=False))
    elif text is not None:
        print(text)


def _ids(value: str | None) -> list[str] | None:
    return [s.strip() for s in value.split(",") if s.strip()] if value else None


def _client():
    from bigviz.provider import Config, ImageClient

    cfg = Config.from_env()
    if not cfg.api_key:
        raise RuntimeError("BIGVIZ_API_KEY is not set (also see BIGVIZ_BASE_URL, BIGVIZ_MODEL)")
    return ImageClient(cfg)


def _default_out(spec: Spec | None, name: str) -> Path:
    return (spec.dir("shots") / name) if spec else Path(name)


# --------------------------------------------------------------------------- init / doctor / probe


def cmd_init(args) -> int:
    path = init_workspace(Path(args.dir), args.slug, args.preset, args.locale, args.force)
    _emit(args, {"spec": str(path), "workspace": str(path.parent)},
          f"created {path}\nnext: edit the spec, then `bigviz prompt design --spec {path}`")
    return 0


def _chromium_installed() -> bool:
    env = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if env and env != "0":
        roots = [Path(env)]
    elif sys.platform == "win32":
        roots = [Path(os.environ.get("LOCALAPPDATA", "")) / "ms-playwright"]
    elif sys.platform == "darwin":
        roots = [Path.home() / "Library" / "Caches" / "ms-playwright"]
    else:
        roots = [Path.home() / ".cache" / "ms-playwright"]
    return any(any(r.glob("chromium*")) for r in roots if r.is_dir())


def cmd_doctor(args) -> int:
    checks: list[dict] = []

    def add(name: str, ok: bool, detail: str, required: bool = True) -> None:
        checks.append({"check": name, "ok": ok, "detail": detail, "required": required})

    add("python", sys.version_info >= (3, 10), f"{platform.python_version()} ({sys.executable})")
    for mod, label in (("PIL", "pillow"), ("numpy", "numpy"), ("cv2", "opencv"), ("yaml", "pyyaml")):
        try:
            m = importlib.import_module(mod)
            add(label, True, getattr(m, "__version__", "installed"))
        except ImportError as exc:
            add(label, False, f"missing: {exc}")
    from bigviz.shot import playwright_available

    has_pw = playwright_available()
    add("playwright", has_pw, "installed" if has_pw else "not installed: pip install 'bigviz[shot]'", False)
    if has_pw:
        ok = _chromium_installed()
        add("chromium", ok, "found" if ok else "run: playwright install chromium", False)
    from bigviz.provider import Config

    cfg = Config.from_env()
    add("BIGVIZ_API_KEY", bool(cfg.api_key), "set" if cfg.api_key else "not set (needed for gen/edit/regen/probe)",
        False)
    add("BIGVIZ_BASE_URL", True, cfg.base_url, False)
    add("BIGVIZ_MODEL", True, cfg.model, False)
    add("presets", True, ", ".join(preset_names()))
    try:
        spec = _try_spec(args)
        add("spec", True, str(spec.path) if spec else "no spec in this directory", False)
    except SpecError as exc:
        add("spec", False, "; ".join(exc.errors), False)
    failed = [c for c in checks if c["required"] and not c["ok"]]
    if _json(args):
        _emit(args, {"ok": not failed, "checks": checks})
    else:
        for c in checks:
            mark = "ok  " if c["ok"] else ("FAIL" if c["required"] else "warn")
            print(f"[{mark}] {c['check']:<16} {c['detail']}")
    return 1 if failed else 0


def cmd_probe(args) -> int:
    client = _client()
    model = args.model or client.config.model
    spec = _try_spec(args)
    out_path = (spec.workspace if spec else Path.cwd()) / PROBE_FILE
    results = []
    for size in [s.strip() for s in args.sizes.split(",") if s.strip()]:
        try:
            res = client.generate("A plain flat grey square, nothing else.", model=model, size=size,
                                  quality="low", n=1)[0]
            results.append({"requested": size, "actual": res.size, "match": not res.mismatch})
        except Exception as exc:  # noqa: BLE001 - record and continue with the next size
            results.append({"requested": size, "error": str(exc)})
        if not _json(args):
            r = results[-1]
            print(f"{size:>10} -> {r.get('actual', 'ERROR ' + r.get('error', ''))}")
    data = {"base_url": client.config.base_url, "model": model, "results": results}
    out_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    _emit(args, data, f"saved {out_path}")
    return 0 if all("actual" in r for r in results) else 1


# --------------------------------------------------------------------------- prompt / gen / edit


def cmd_prompt(args) -> int:
    spec = _spec(args, check_files=False)
    kind = args.kind
    if kind == "design":
        text = P.design_prompt(spec, args.variant, args.hero)
        name = "-".join(x for x in (spec.slug, "design", args.variant, args.hero) if x)
    elif kind == "panel":
        text, name = P.panel_prompt(spec, args.id), f"{spec.slug}-panel-{args.id}"
    elif kind == "paste":
        text, name = P.paste_back_prompt(spec, args.id), f"{spec.slug}-paste-{args.id}"
    elif kind == "fix":
        fixes = list(args.fix)
        if args.from_file:
            lines = Path(args.from_file).read_text(encoding="utf-8").splitlines()
            fixes += [ln.strip() for ln in lines if ln.strip() and not ln.lstrip().startswith("#")]
        text, name = P.fix_prompt(spec, fixes), f"{spec.slug}-fix"
    else:
        asset = spec.asset(args.asset)
        if not asset["regen"]:
            raise SpecError(f"spec.assets[{args.asset}].regen: false, nothing to regenerate")
        text = P.regen_prompt(asset["regen"]["subject"], asset["regen"]["fill"])
        name = f"{spec.slug}-regen-{args.asset}"
    path = None if args.no_save else P.save_prompt(spec, safe_name(args.name or name), text)
    if _json(args):
        _emit(args, {"kind": kind, "file": str(path) if path else None, "prompt": text})
    else:
        sys.stdout.write(text)
        if path:
            print(f"\n# saved {path}", file=sys.stderr)
    return 0


def _run_images(args, refs: list[Path] | None) -> int:
    prompt_file = Path(args.prompt_file)
    prompt = prompt_file.read_text(encoding="utf-8")
    spec = _try_spec(args)
    client = _client()
    model = args.model or client.config.model
    size = None if args.size == "auto" else args.size
    quality = None if args.quality == "auto" else args.quality
    if refs:
        missing = [str(r) for r in refs if not r.is_file()]
        if missing:
            raise FileNotFoundError(f"reference image(s) not found: {', '.join(missing)}")
        results = client.edit(prompt, refs, model=model, size=size, quality=quality, n=args.n)
    else:
        results = client.generate(prompt, model=model, size=size, quality=quality, n=args.n)
    out_dir = Path(args.out) if args.out else (spec.dir("designs") if spec else Path("designs"))
    slug = spec.slug if spec else safe_name(prompt_file.stem)
    stem = f"{slug}-{safe_name(args.tag)}-{safe_name(model)}"
    written = []
    for res, path in zip(results, output_paths(out_dir, stem, len(results))):
        path.write_bytes(res.data)
        write_sidecar(path, prompt_file=prompt_file, prompt_text=prompt, model=model,
                      size_requested=size, size_actual=res.size, quality=quality, refs=refs,
                      kind="edit" if refs else "generate",
                      extra={"revised_prompt": res.revised_prompt} if res.revised_prompt else None)
        written.append({"image": str(path), "size": res.size, "size_mismatch": res.mismatch})
        if not _json(args):
            note = f"  (requested {size})" if res.mismatch else ""
            print(f"{path}  {res.size}{note}")
    _emit(args, written)
    return 0


def cmd_gen(args) -> int:
    return _run_images(args, None)


def cmd_edit(args) -> int:
    return _run_images(args, [Path(p.strip()) for p in args.image.split(",") if p.strip()])


# --------------------------------------------------------------------------- assets


def cmd_sheet(args) -> int:
    from bigviz.sheet import contact_sheet, expand

    paths = expand(args.glob)
    if not paths:
        raise FileNotFoundError(f"no images match: {' '.join(args.glob)}")
    out = Path(args.out) if args.out else _default_out(_try_spec(args), "sheet.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    contact_sheet(paths, cols=args.cols, bg=args.bg, cell=args.cell).save(out)
    _emit(args, {"sheet": str(out), "count": len(paths)}, f"{out}  ({len(paths)} images)")
    return 0


def cmd_slice(args) -> int:
    from bigviz.slice import slice_assets

    written = slice_assets(_spec(args), _ids(args.ids))
    _emit(args, [str(p) for p in written], "\n".join(str(p) for p in written) or "no assets in spec")
    return 0


def _box(text: str) -> tuple[int, int, int, int]:
    parts = [int(v) for v in text.replace(" ", "").split(",")]
    if len(parts) != 4:
        raise ValueError(f"box must be x,y,w,h, got '{text}'")
    return tuple(parts)  # type: ignore[return-value]


def _matte_kwargs(args) -> dict:
    kw: dict = {}
    if args.method == "unscreen":
        f = (args.feather or "rect:0.22").lower()
        if f != "none":
            kind, _, val = f.partition(":")
            if kind not in ("rect", "ellipse"):
                raise ValueError("--feather must be rect:<f>, ellipse:<inner> or none")
            kw[f"feather_{kind}"] = float(val or (0.22 if kind == "rect" else 0.72))
        else:
            kw["feather_rect"] = None
        if args.bg and args.bg != "auto":
            kw["bg"] = "rows" if args.bg == "rows" else Image.new("RGB", (1, 1), args.bg).getpixel((0, 0))
        if args.gain is not None:
            kw["gain"] = args.gain
        if args.bias is not None:
            kw["bias"] = args.bias
        if args.gate:
            kw["gate"] = True
    elif args.method == "black":
        if args.gain is not None:
            kw["gain"] = args.gain
        if args.floor is not None:
            kw["floor"] = args.floor
    elif args.method == "grabcut":
        if args.rect:
            kw["rect"] = _box(args.rect)
        elif args.seed:
            kw["seed_fn"] = args.seed
    return kw


def cmd_matte(args) -> int:
    from bigviz.slice import matte_assets, matte_image

    if args.src:
        if not args.dst:
            raise ValueError("matte SRC DST: destination missing")
        with Image.open(args.src) as im:
            out = matte_image(im.convert("RGB"), args.method, **_matte_kwargs(args))
        Path(args.dst).parent.mkdir(parents=True, exist_ok=True)
        out.save(args.dst, optimize=True)
        _emit(args, {"out": args.dst, "size": list(out.size)}, f"{args.dst}  {out.width}x{out.height}")
        return 0
    written = matte_assets(_spec(args), _ids(args.ids))
    _emit(args, [str(p) for p in written], "\n".join(str(p) for p in written) or "no assets in spec")
    return 0


def cmd_erase(args) -> int:
    boxes = [_box(b) for b in args.boxes.split(";") if b.strip()]
    with Image.open(args.src) as im:
        out = M.erase_text(im.convert("RGBA") if im.mode == "RGBA" else im.convert("RGB"), boxes,
                           mode=args.mode, thresh=args.thresh)
    Path(args.dst).parent.mkdir(parents=True, exist_ok=True)
    out.save(args.dst, optimize=True)
    _emit(args, {"out": args.dst, "boxes": len(boxes)}, f"{args.dst}  ({len(boxes)} boxes erased)")
    return 0


def cmd_regen(args) -> int:
    from bigviz.regen import regen_all

    spec = _spec(args)
    needs_api = not (args.dry_run or args.reuse) and any(a["regen"] for a in spec.select_assets(_ids(args.ids)))
    client = _client() if needs_api else None

    def done(r: dict) -> None:
        if not _json(args):
            tail = r.get("final") or r.get("ref") or r.get("error", "")
            print(f"[{r['status']}] {r['id']}  {tail}")

    results = regen_all(spec, _ids(args.ids), client, jobs=args.jobs, on_done=done,
                        dry_run=args.dry_run, reuse=args.reuse, quality=args.quality, model=args.model)
    _emit(args, results)
    return 1 if any(r["status"] == "error" for r in results) else 0


def cmd_manifest(args) -> int:
    from bigviz.manifest import build_manifest

    out = build_manifest(_spec(args, check_files=False))
    data = json.loads(out.read_text(encoding="utf-8"))
    _emit(args, data, f"{out}  ({len(data['assets'])} assets)")
    return 0


def cmd_publish(args) -> int:
    from bigviz.publish import publish

    res = publish(_spec(args, check_files=False), args.app, args.name)
    _emit(args, res, f"backup   {res['backup']}\nassets   {res['asset_dir']} ({res['count']})\n"
                     f"manifest {res['manifest_ts']}")
    return 0


# --------------------------------------------------------------------------- QA


def cmd_shot(args) -> int:
    from bigviz.shot import capture

    out = Path(args.out) if args.out else _default_out(_try_spec(args), "shot.png")
    paths = capture(args.url, out, viewport=args.viewport, dpr=args.dpr, selector=args.selector,
                    frames=args.frames, interval=args.interval, wait=args.wait,
                    login_script=args.login_script, full_page=args.full_page)
    data = {"frames": [str(p) for p in paths]}
    if len(paths) > 1:
        from bigviz.sheet import contact_sheet

        sheet = out.with_name(f"{out.stem}-frames.png")
        contact_sheet(paths, cols=min(4, len(paths))).save(sheet)
        data["sheet"] = str(sheet)
    _emit(args, data, "\n".join(data["frames"] + ([data["sheet"]] if "sheet" in data else [])))
    return 0


def cmd_overlay(args) -> int:
    from bigviz.sheet import overlay

    shot = Path(args.shot)
    blend, heat, score = overlay(shot, Path(args.design), args.alpha, args.diff)
    out = Path(args.out) if args.out else shot.with_name(f"{shot.stem}-overlay.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    blend.save(out)
    data = {"overlay": str(out)}
    if heat is not None:
        diff_path = out.with_name(f"{shot.stem}-diff.png")
        heat.save(diff_path)
        data.update(diff=str(diff_path), mean_diff=round(score, 4))
    text = str(out) + (f"\n{data['diff']}  mean abs diff {data['mean_diff']:.4f}" if heat is not None else "")
    _emit(args, data, text)
    return 0
