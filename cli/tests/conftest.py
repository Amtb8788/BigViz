"""Shared fixtures: a synthetic mockup and a workspace with a full spec."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import yaml
from PIL import Image

from bigviz.spec import load_spec

BG = (8, 30, 86)
DESIGN_W, DESIGN_H = 640, 360


def glow_disc(size: int, colour=(80, 200, 255), radius: float = 0.35) -> np.ndarray:
    """Float RGBA (0-1) disc with a solid core and a soft glow falloff."""
    yy, xx = np.mgrid[0:size, 0:size]
    r = np.hypot(xx - (size - 1) / 2, yy - (size - 1) / 2) / size
    alpha = np.clip(1 - (r - radius * 0.5) / (radius * 0.5), 0, 1)
    rgb = np.ones((size, size, 3)) * np.asarray(colour, float) / 255
    return np.dstack([rgb, alpha])


def make_design(path: Path) -> Path:
    """Dark-blue panel with a glowing disc (asset `orb`) and a bright square (asset `tile`)."""
    canvas = np.ones((DESIGN_H, DESIGN_W, 3)) * np.asarray(BG, float) / 255
    disc = glow_disc(120)
    a = disc[..., 3:4]
    y, x = 40, 60
    canvas[y:y + 120, x:x + 120] = disc[..., :3] * a + canvas[y:y + 120, x:x + 120] * (1 - a)
    canvas[200:280, 400:480] = (1.0, 0.8, 0.3)
    Image.fromarray((canvas * 255).round().astype(np.uint8)).save(path)
    return path


SPEC = {
    "version": 1,
    "meta": {"slug": "demo-screen", "title": "Demo Data Center", "project": "Demo Project",
             "locale": "en", "canvas": {"width": 1920, "height": 1080}},
    "style": {"preset": "deep-tech-blue", "palette": {"accent": "#33CCFF"}},
    "layout": {"columns": [24, 52, 24]},
    "panels": [
        {"id": "trend", "column": "left", "title": "Points Trend", "type": "line",
         "data": {"x": ["Mon", "Tue", "Wed"], "series": [{"name": "Earned", "values": [120, 98, 143]}]}},
        {"id": "teams", "column": "right", "title": "Team Ranking", "type": "rank",
         "data": {"items": [{"name": "Rebar Team 1", "value": 4860, "unit": "pts"},
                            {"name": "Carpentry Team 3", "value": 4512, "unit": "pts"}]}},
        {"id": "mix", "column": "right", "title": "Category Mix", "type": "ring",
         "data": {"segments": [{"name": "Safety Gear", "value": 38, "unit": "%"}]},
         "notes": "thin ring"},
    ],
    "hero": {"concept": "shield", "variants": {"shield": "a glowing 3D glass shield", "core": "a data core"},
             "nodes": [{"label": "Safety Check", "icon": "helmet", "value": 3846, "unit": "people"}]},
    "kpis": [{"label": "Total Points", "value": 128560, "unit": "pts", "icon": "coins", "delta": "+8.7%"}],
    "pitfalls": ["Rebar Team 1", "Liu*Qiang"],
    "design": {"versions": [{"tag": "v1", "note": "first"}], "final": "designs/demo-v1.png"},
    "assets": [
        {"id": "orb", "box": [50, 30, 140, 140], "matte": "unscreen",
         "regen": {"subject": "a glowing orb", "fill": 0.8}, "target": 200, "use": "HeroOrb"},
        {"id": "tile", "box": [390, 190, 100, 100], "matte": "none", "regen": False, "target": 120},
    ],
}


@pytest.fixture
def spec_data() -> dict:
    import copy

    return copy.deepcopy(SPEC)


@pytest.fixture
def workspace(tmp_path: Path, spec_data: dict) -> Path:
    ws = tmp_path / "bigviz" / "demo-screen"
    (ws / "designs").mkdir(parents=True)
    make_design(ws / "designs" / "demo-v1.png")
    (ws / "bigviz.yaml").write_text(yaml.safe_dump(spec_data, sort_keys=False), encoding="utf-8")
    return ws


@pytest.fixture
def spec(workspace: Path):
    return load_spec(workspace / "bigviz.yaml")
