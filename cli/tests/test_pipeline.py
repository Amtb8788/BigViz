"""slice -> matte -> regen (no API) -> manifest -> publish on a generated PNG."""

from __future__ import annotations

import json
from datetime import datetime

import numpy as np
import pytest
from PIL import Image

from bigviz.manifest import build_manifest
from bigviz.publish import ident, publish, render_ts, view_name
from bigviz.regen import pick_size, regen_all
from bigviz.slice import matte_assets, slice_assets


def test_slice_writes_x2_placeholders(spec):
    paths = slice_assets(spec)
    assert [p.name for p in paths] == ["orb.png", "tile.png"]
    with Image.open(paths[0]) as im:
        assert im.size == (280, 280)
    only = slice_assets(spec, ["tile"])
    assert len(only) == 1


def test_matte_and_manifest(spec):
    matte_assets(spec)
    with Image.open(spec.workspace / "assets/alpha/orb.png") as im:
        a = np.asarray(im)[..., 3]
    assert a[140, 140] > 240 and a[0, 0] == 0  # glowing disc kept, panel removed
    # regen: false -> straight from alpha; regen: true + dry-run -> only a reference
    res = regen_all(spec, jobs=2, dry_run=True)
    assert {r["id"]: r["status"] for r in res} == {"orb": "dry-run", "tile": "copied"}
    assert (spec.workspace / "assets/regen/orb/ref.png").is_file()
    assert (spec.workspace / "assets/regen/orb/prompt.txt").read_text().startswith("Recreate a glowing orb")
    # simulate an AI render on black for `orb` and re-process it without the API
    render = Image.new("RGB", (1024, 1024))
    render.paste((60, 200, 255), (312, 262, 712, 762))  # 400 x 500 body
    render.save(spec.workspace / "assets/regen/orb/orb-gpt-image-1.png")
    res = regen_all(spec, ["orb"], reuse=True)
    assert res[0]["status"] == "regenerated"
    out = build_manifest(spec)
    data = json.loads(out.read_text())
    by_id = {a["id"]: a for a in data["assets"]}
    assert [a["id"] for a in data["assets"]] == ["orb", "tile"]
    assert by_id["orb"]["height"] == 200 and by_id["orb"]["width"] == 160  # target = 200 longest edge
    assert by_id["orb"]["aspect"] == 0.8 and by_id["orb"]["use"] == "HeroOrb"
    assert by_id["tile"]["width"] == 120  # 200x200 opaque crop fitted to 120
    assert set(by_id["orb"]["trim"]) == {"l", "t", "r", "b"}


def test_pick_size():
    assert pick_size(300, 100) == "1536x1024"
    assert pick_size(100, 300) == "1024x1536"
    assert pick_size(100, 110) == "1024x1024"


def test_publish_backup_and_manifest_ts(spec, tmp_path):
    final = spec.dir("assets/final")
    rgba = Image.new("RGBA", (100, 50), (0, 0, 0, 0))
    rgba.paste((255, 255, 255, 255), (10, 5, 90, 45))
    rgba.save(final / "center-hub.png")
    Image.new("RGBA", (40, 40), (255, 0, 0, 255)).save(final / "kpi-1.png")
    app = tmp_path / "web"
    (app / "src").mkdir(parents=True)
    old_dir = app / "src/assets/bigviz/demo-screen"
    old_dir.mkdir(parents=True)
    Image.new("RGB", (4, 4)).save(old_dir / "stale.png")
    view = app / "src/views/DemoScreen"
    view.mkdir(parents=True)
    (view / "assets.manifest.ts").write_text("// old\n")

    res = publish(spec, app, now=datetime(2026, 10, 18, 14, 32, 8))
    backup = spec.workspace / "backup" / "20261018-143208"
    assert res["backup"] == str(backup)
    assert (backup / "assets" / "stale.png").is_file()
    assert (backup / "assets.manifest.ts").read_text() == "// old\n"
    assert not (old_dir / "stale.png").exists()
    assert (old_dir / "center-hub.png").is_file() and (old_dir / "kpi-1.png").is_file()
    ts = (view / "assets.manifest.ts").read_text()
    assert 'import centerHubSrc from "../../assets/bigviz/demo-screen/center-hub.png"' in ts
    assert '"center-hub": { id: "center-hub", src: centerHubSrc, width: 100, height: 50, aspect: 2,' in ts
    assert "trim: { l: 0.1, t: 0.1, r: 0.1, b: 0.1 }" in ts
    assert "export interface BigVizAsset" in ts and "satisfies Record<string, BigVizAsset>" in ts
    # a second publish in the same second gets its own backup dir
    res2 = publish(spec, app, now=datetime(2026, 10, 18, 14, 32, 8))
    assert res2["backup"].endswith("20261018-143208-2")


def test_publish_requires_app_src(spec, tmp_path):
    with pytest.raises(FileNotFoundError):
        publish(spec, tmp_path / "nope")


def test_ts_helpers():
    assert view_name("safety-points") == "SafetyPoints"
    assert ident("center-hub") == "centerHub" and ident("3d-icon") == "img_3dIcon"
    ts = render_ts("x", [{"id": "a", "file": "a.png", "width": 1, "height": 1, "aspect": 1.0,
                          "trim": {"l": 0, "t": 0, "r": 0, "b": 0}}], "./assets")
    assert 'import aSrc from "./assets/a.png"' in ts
    # names that could break out of the generated string literal are rejected
    bad = [{"id": "a'b", "file": "a'b.png", "width": 1, "height": 1, "aspect": 1.0,
            "trim": {"l": 0, "t": 0, "r": 0, "b": 0}}]
    with pytest.raises(ValueError):
        render_ts("x", bad, "./assets")
