"""`bigviz` command line. Commands are implemented in `bigviz.commands`."""

from __future__ import annotations

import argparse
import logging
import sys

from bigviz import __version__
from bigviz import commands as C
from bigviz.spec import SpecError


def _common() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(add_help=False)
    # SUPPRESS: lets the option appear before or after the sub-command without the
    # sub-parser's default overwriting a value given at the top level
    p.add_argument("--spec", metavar="PATH", default=argparse.SUPPRESS,
                   help="bigviz.yaml (default: ./bigviz.yaml or the only bigviz/*/bigviz.yaml)")
    p.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="machine-readable output")
    return p


def _gen_opts(p: argparse.ArgumentParser) -> None:
    p.add_argument("--tag", required=True, help="version tag used in the file name, e.g. v5")
    p.add_argument("--n", type=int, default=1, help="number of images (default 1)")
    p.add_argument("--size", default="1536x1024", help="WxH or auto (default 1536x1024)")
    p.add_argument("--quality", default="high", choices=["low", "medium", "high", "auto"])
    p.add_argument("--model", help="override BIGVIZ_MODEL")
    p.add_argument("--out", metavar="DIR", help="output dir (default: <workspace>/designs)")


def build_parser() -> argparse.ArgumentParser:
    common = _common()
    ap = argparse.ArgumentParser(prog="bigviz", description="Spec-driven data-visualisation big screens.",
                                 parents=[common])
    ap.add_argument("--version", action="version", version=f"bigviz {__version__}")
    ap.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    sub = ap.add_subparsers(dest="cmd", metavar="<command>", required=True)

    def add(name: str, help_: str) -> argparse.ArgumentParser:
        return sub.add_parser(name, help=help_, description=help_, parents=[common])

    p = add("init", "scaffold a workspace bigviz/<slug>/ with a starter spec")
    p.add_argument("slug")
    p.add_argument("--preset", default="deep-tech-blue")
    p.add_argument("--locale", default="en", choices=["en", "zh"])
    p.add_argument("--dir", default=".", help="project root (default: current directory)")
    p.add_argument("--force", action="store_true", help="overwrite an existing bigviz.yaml")

    add("doctor", "check Python deps, Playwright browser and API env vars")

    p = add("probe", "request tiny low-quality images and record the real returned sizes")
    p.add_argument("--sizes", default="1024x1024,1536x1024,2048x1152")
    p.add_argument("--model")

    p = add("prompt", "print and save a composed prompt")
    psub = p.add_subparsers(dest="kind", metavar="<kind>", required=True)
    q = psub.add_parser("design", help="full-screen mockup prompt", parents=[common])
    q.add_argument("--variant", help="preset name to use instead of style.preset (style shoot-out)")
    q.add_argument("--hero", help="key of hero.variants")
    q = psub.add_parser("panel", help="refine one panel in place", parents=[common])
    q.add_argument("id")
    q = psub.add_parser("paste", help="paste a refined panel back into the mockup", parents=[common])
    q.add_argument("id")
    q = psub.add_parser("fix", help="targeted text corrections", parents=[common])
    q.add_argument("--fix", action="append", default=[], metavar="TEXT", help="one correction (repeatable)")
    q.add_argument("--from", dest="from_file", metavar="FILE", help="file with one correction per line")
    q = psub.add_parser("regen", help="HD regeneration prompt for one asset", parents=[common])
    q.add_argument("asset")
    for q in psub.choices.values():
        q.add_argument("--name", help="prompt file name without .txt (default derived from the kind)")
        q.add_argument("--no-save", action="store_true", help="print only")

    p = add("gen", "text -> image into designs/, auto-named, with a JSON sidecar")
    p.add_argument("prompt_file")
    _gen_opts(p)

    p = add("edit", "image edit (fix / panel paste-back / regen) with reference images")
    p.add_argument("prompt_file")
    p.add_argument("--image", required=True, help="reference image(s), comma separated")
    _gen_opts(p)

    p = add("sheet", "labelled contact sheet")
    p.add_argument("glob", nargs="+")
    p.add_argument("--cols", type=int, default=4)
    p.add_argument("--bg", default="#081E56")
    p.add_argument("--cell", type=int, default=480, help="thumbnail longest edge (default 480)")
    p.add_argument("-o", "--out", help="output PNG (default: <workspace>/shots/sheet.png or ./sheet.png)")

    p = add("slice", "crop assets[] boxes from design.final into assets/placeholder/ (x2)")
    p.add_argument("--ids", help="comma-separated asset ids (default: all)")

    p = add("matte", "background removal: `matte SRC DST --method ...` or `matte --ids ...` (spec)")
    p.add_argument("src", nargs="?")
    p.add_argument("dst", nargs="?")
    p.add_argument("--ids", help="spec mode: comma-separated asset ids (default: all)")
    p.add_argument("--method", choices=["none", "unscreen", "black", "grabcut"], default="unscreen")
    p.add_argument("--feather", default=None,
                   help="unscreen edge fade: rect:0.22 | ellipse:0.72 | none (default rect:0.22)")
    p.add_argument("--bg", default=None, help="unscreen background: auto | rows | #RRGGBB (default auto)")
    p.add_argument("--gain", type=float, help="unscreen default 1.4, black default 1.25")
    p.add_argument("--bias", type=float, help="unscreen alpha bias (default 0.04)")
    p.add_argument("--floor", type=float, help="black floor (default 0.06)")
    p.add_argument("--gate", action="store_true", help="unscreen noise gate (drop faint haze)")
    p.add_argument("--seed", choices=["warm", "neutral", "bright"], help="grabcut colour seed")
    p.add_argument("--rect", help="grabcut rect x,y,w,h instead of a colour seed")

    p = add("erase", "remove baked-in text (inpaint + row interpolation)")
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--boxes", required=True, help="x,y,w,h;x,y,w,h;...")
    p.add_argument("--mode", choices=["bright", "all"], default="bright",
                   help="bright = only bright glyph pixels, all = whole box")
    p.add_argument("--thresh", type=float, default=95, help="glyph luminance threshold (bright mode)")

    p = add("regen", "AI HD regeneration -> black matte -> trim -> assets/final/")
    p.add_argument("--ids", help="comma-separated asset ids (default: all)")
    p.add_argument("--jobs", type=int, default=3)
    p.add_argument("--quality", default="high", choices=["low", "medium", "high", "auto"])
    p.add_argument("--model")
    p.add_argument("--reuse", action="store_true", help="re-process the latest existing output, no API call")
    p.add_argument("--dry-run", action="store_true", help="write references and prompts only")

    add("manifest", "measure final assets into assets/final/manifest.json")

    p = add("publish", "backup, copy finals into the app, write assets.manifest.ts")
    p.add_argument("--app", required=True, help="front-end app root (contains src/)")
    p.add_argument("--name", help="view name (default: PascalCase slug)")

    p = add("shot", "Playwright screenshots / motion frames")
    p.add_argument("url")
    p.add_argument("--viewport", default="1920x1080")
    p.add_argument("--dpr", type=float, default=2)
    p.add_argument("--selector")
    p.add_argument("--frames", type=int, default=1)
    p.add_argument("--interval", type=int, default=180, help="ms between frames")
    p.add_argument("--wait", type=int, default=1500, help="ms to wait after load")
    p.add_argument("--login-script",
                   help="python file exposing login(page); it is executed with your user's "
                        "permissions, so only pass scripts you trust")
    p.add_argument("--full-page", action="store_true")
    p.add_argument("-o", "--out", help="output PNG (default: <workspace>/shots/shot.png or ./shot.png)")

    p = add("overlay", "overlay or diff a screenshot against its mockup")
    p.add_argument("shot")
    p.add_argument("design")
    p.add_argument("--alpha", type=float, default=0.5)
    p.add_argument("--diff", action="store_true", help="also write an abs-diff heatmap")
    p.add_argument("-o", "--out", help="overlay PNG (default: <shot>-overlay.png)")
    return ap


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(levelname)s %(message)s", stream=sys.stderr)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    handler = getattr(C, f"cmd_{args.cmd}")
    try:
        return int(handler(args) or 0)
    except SpecError as exc:
        print("spec error:\n  " + "\n  ".join(exc.errors), file=sys.stderr)
        return 2
    except (OSError, KeyError, ValueError, RuntimeError) as exc:
        msg = exc.args[0] if isinstance(exc, KeyError) and exc.args else exc
        print(f"error: {msg}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
