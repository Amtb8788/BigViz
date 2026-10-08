"""Generation records: one JSON sidecar next to every generated image.

`designs/<slug>-v5-gpt-image-1.png` gets `designs/<slug>-v5-gpt-image-1.json`
with the prompt file, prompt hash, model, requested/actual size, quality,
reference images and a UTC timestamp. Never contains API keys.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def prompt_hash(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def safe_name(s: str) -> str:
    """File-name-safe token (model names may contain '/' or ':')."""
    return re.sub(r"[^A-Za-z0-9._-]+", "-", s).strip("-") or "x"


def output_paths(directory: Path, stem: str, n: int) -> list[Path]:
    """`<stem>.png` for one image, `<stem>-1.png …` for several; never overwrites."""
    directory.mkdir(parents=True, exist_ok=True)
    if n == 1 and not (directory / f"{stem}.png").exists():
        return [directory / f"{stem}.png"]
    out, i = [], 1
    while len(out) < n:
        p = directory / f"{stem}-{i}.png"
        if not p.exists():
            out.append(p)
        i += 1
    return out


def sidecar_path(image: Path) -> Path:
    return Path(image).with_suffix(".json")


def write_sidecar(image: Path, *, prompt_file: Path | str | None, prompt_text: str, model: str,
                  size_requested: str | None, size_actual: str, quality: str | None,
                  refs: list[Path | str] | None = None, kind: str = "generate",
                  extra: dict[str, Any] | None = None) -> Path:
    """Write the sidecar JSON for `image` and return its path."""
    record = {
        "image": Path(image).name,
        "kind": kind,
        "prompt_file": str(prompt_file) if prompt_file else None,
        "prompt_hash": prompt_hash(prompt_text),
        "model": model,
        "size_requested": size_requested,
        "size_actual": size_actual,
        "size_mismatch": bool(size_requested and size_requested != "auto" and size_requested != size_actual),
        "quality": quality,
        "refs": [str(r) for r in (refs or [])],
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if extra:
        record.update(extra)
    path = sidecar_path(image)
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def read_sidecar(image: Path) -> dict | None:
    p = sidecar_path(image)
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else None
