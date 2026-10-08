"""Playwright screenshots and motion frames (optional extra: `pip install bigviz[shot]`).

Supports viewport + device scale factor, clipping to a CSS selector, a
fixed wait before capture, several frames at an interval (motion QA) and an
optional login script: a Python file exposing `login(page)` that is run
before navigating to the target URL.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType


class ShotError(RuntimeError):
    pass


def playwright_available() -> bool:
    return importlib.util.find_spec("playwright") is not None


def parse_viewport(value: str) -> tuple[int, int]:
    try:
        w, h = value.lower().split("x")
        return int(w), int(h)
    except ValueError as exc:
        raise ShotError(f"viewport must look like 1920x1080, got '{value}'") from exc


def load_login(path: Path | str) -> ModuleType:
    """Import a login script; it must define `login(page)`."""
    path = Path(path)
    if not path.is_file():
        raise ShotError(f"login script not found: {path}")
    spec = importlib.util.spec_from_file_location("bigviz_login", path)
    if spec is None or spec.loader is None:
        raise ShotError(f"cannot import login script: {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not callable(getattr(mod, "login", None)):
        raise ShotError(f"{path} must define a function `login(page)`")
    return mod


def frame_paths(out: Path, frames: int) -> list[Path]:
    if frames <= 1:
        return [out]
    return [out.with_name(f"{out.stem}-{i:02d}{out.suffix}") for i in range(1, frames + 1)]


def capture(url: str, out: Path | str, viewport: str = "1920x1080", dpr: float = 2,
            selector: str | None = None, frames: int = 1, interval: int = 180,
            wait: int = 1500, login_script: Path | str | None = None,
            full_page: bool = False, timeout: int = 30000) -> list[Path]:
    """Capture `frames` screenshots of `url`; returns the written paths."""
    if not playwright_available():
        raise ShotError("Playwright is not installed: pip install 'bigviz[shot]' && "
                        "playwright install chromium")
    from playwright.sync_api import sync_playwright

    w, h = parse_viewport(viewport)
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    login = load_login(login_script) if login_script else None
    paths = frame_paths(out, frames)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr)
            page = ctx.new_page()
            page.set_default_timeout(timeout)
            if login:
                login.login(page)
            page.goto(url, wait_until="networkidle")
            if wait > 0:
                page.wait_for_timeout(wait)
            target = page.locator(selector).first if selector else None
            if target is not None:
                target.wait_for(state="visible")
            for i, p in enumerate(paths):
                if i and interval > 0:
                    page.wait_for_timeout(interval)
                if target is not None:
                    target.screenshot(path=str(p))
                else:
                    page.screenshot(path=str(p), full_page=full_page)
        finally:
            browser.close()
    return paths
