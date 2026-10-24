"""Template kit layering: core ← 2d, core ← 3d; 2d and 3d never import each other or views."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

KIT = Path(__file__).parents[2] / "templates/vue3-echarts/src/kit"
IMPORT_RE = re.compile(r"""(?:from\s+|import\s*\(\s*|^import\s+)'(@/[^']+)'""", re.M)

# section -> import prefixes it must not use
FORBIDDEN = {
    "core": ("@/kit/2d", "@/kit/3d", "@/views", "@/api"),
    "2d": ("@/kit/3d", "@/views", "@/api"),
    "3d": ("@/kit/2d", "@/views", "@/api"),
}


def _files(section: str) -> list[Path]:
    return [p for p in (KIT / section).rglob("*") if p.suffix in (".ts", ".vue")]


@pytest.mark.parametrize("section", sorted(FORBIDDEN))
def test_kit_layering(section):
    assert _files(section), f"no files under kit/{section}"
    bad = []
    for path in _files(section):
        for spec in IMPORT_RE.findall(path.read_text(encoding="utf-8")):
            if spec.startswith(FORBIDDEN[section]):
                bad.append(f"{path.relative_to(KIT)} imports {spec}")
    assert not bad, "\n".join(bad)


def test_2d_never_imports_three():
    for path in _files("2d") + _files("core"):
        text = path.read_text(encoding="utf-8")
        assert not re.search(r"from\s+'three(/[^']*)?'", text), path.relative_to(KIT)
