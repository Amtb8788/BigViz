"""Spec and preset validation."""

from __future__ import annotations

import pytest
import yaml

from bigviz.spec import SpecError, find_spec, init_workspace, load_preset, load_spec, preset_names, validate


def test_happy_path_fills_defaults(spec):
    assert spec.slug == "demo-screen"
    assert spec["layout"]["header"] == {"clock": True, "weather": False}
    assert spec["layout"]["bottom_nav"] is False
    assert spec["assets"][1]["erase"] == []
    assert spec["assets"][0]["regen"] == {"subject": "a glowing orb", "fill": 0.8}
    assert spec.palette["accent"] == "#33CCFF"  # override wins
    assert spec.palette["primary"] == "#1E7BFF"  # preset value
    assert spec.final_design == spec.workspace / "designs" / "demo-v1.png"


def test_unknown_top_level_key(spec_data):
    spec_data["colour"] = "red"
    with pytest.raises(SpecError) as e:
        validate(spec_data, check_files=False)
    assert any(err.startswith("spec.colour: unknown key") for err in e.value.errors)


def test_unknown_nested_key_prints_path(spec_data):
    spec_data["assets"][0]["mate"] = "black"
    spec_data["meta"]["canvas"]["depth"] = 3
    with pytest.raises(SpecError) as e:
        validate(spec_data, check_files=False)
    msgs = "\n".join(e.value.errors)
    assert "spec.assets[0].mate: unknown key" in msgs
    assert "spec.meta.canvas.depth: unknown key" in msgs


def test_type_and_enum_errors(spec_data):
    spec_data["assets"][0]["matte"] = "magic"
    spec_data["panels"][0]["column"] = "middle"
    spec_data["meta"]["slug"] = "Not A Slug"
    spec_data["style"]["palette"]["bg9"] = "#000000"
    spec_data["layout"]["columns"] = [30, 30, 30]
    with pytest.raises(SpecError) as e:
        validate(spec_data, check_files=False)
    msgs = "\n".join(e.value.errors)
    for path in ("spec.assets[0].matte", "spec.panels[0].column", "spec.meta.slug",
                 "spec.style.palette", "spec.layout.columns"):
        assert path in msgs


def test_box_outside_design(workspace, spec_data):
    spec_data["assets"][0]["box"] = [600, 300, 100, 100]
    (workspace / "bigviz.yaml").write_text(yaml.safe_dump(spec_data), encoding="utf-8")
    with pytest.raises(SpecError) as e:
        load_spec(workspace / "bigviz.yaml")
    assert "spec.assets[0].box" in str(e.value) and "outside design.final" in str(e.value)


def test_duplicate_ids_and_regen_true(spec_data):
    spec_data["assets"][1]["id"] = "orb"
    spec_data["assets"][1]["regen"] = True
    with pytest.raises(SpecError) as e:
        validate(spec_data, check_files=False)
    msgs = "\n".join(e.value.errors)
    assert "spec.assets[1].regen" in msgs
    assert "spec.assets[1].id: duplicate id 'orb'" in msgs


def test_find_spec(workspace, tmp_path):
    assert find_spec(None, cwd=tmp_path) == workspace / "bigviz.yaml"
    assert find_spec(None, cwd=workspace) == workspace / "bigviz.yaml"
    with pytest.raises(SpecError):
        find_spec(None, cwd=workspace / "designs")


def test_presets_valid():
    names = preset_names()
    assert {"deep-tech-blue", "editorial-dark", "aurora-glass"} <= set(names)
    for n in names:
        p = load_preset(n)
        assert p["name"] == n and len(p["palette"]) == 8


def test_init_starter_is_valid(tmp_path):
    path = init_workspace(tmp_path, "my-screen", "aurora-glass", "zh")
    s = load_spec(path)
    assert s.slug == "my-screen" and s.locale == "zh" and s["style"]["preset"] == "aurora-glass"
    for d in ("prompts", "designs", "assets/placeholder", "assets/alpha", "assets/regen",
              "assets/final", "shots", "backup"):
        assert (path.parent / d).is_dir()
    with pytest.raises(SpecError):
        init_workspace(tmp_path, "my-screen")
    with pytest.raises(SpecError):
        init_workspace(tmp_path, "Bad Slug")
