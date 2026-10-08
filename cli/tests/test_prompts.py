"""Prompt composition."""

from __future__ import annotations

import pytest

from bigviz import prompts as P


def test_design_prompt_contains_everything(spec):
    text = P.design_prompt(spec)
    for p in spec["panels"]:
        assert f'"{p["title"]}"' in text
    for s in spec["pitfalls"]:
        assert f'"{s}"' in text
    for hexv in spec.palette.values():
        assert hexv in text
    assert "#33CCFF" in text  # spec override, not the preset accent
    assert "Typography (MOST IMPORTANT)" in text
    assert "4,860 pts" in text and "128,560 pts" in text and "Mon, Tue, Wed" in text
    assert "no monitor" in text and "mock-up frame" in text
    assert "no bottom navigation bar" in text
    assert "a glowing 3D glass shield" in text
    order = [text.index(h) for h in ("## Positioning", "## Material", "## Visual system",
                                     "## Typography", "## Layout", "## Pitfalls", "## Avoid")]
    assert order == sorted(order)


def test_design_prompt_variant_hero_and_nav(spec):
    spec.data["layout"]["bottom_nav"] = True
    text = P.design_prompt(spec, variant="editorial-dark", hero="core")
    assert "#07080B" in text  # editorial palette
    assert "a data core" in text
    assert "no bottom navigation bar" not in text
    with pytest.raises(KeyError):
        P.design_prompt(spec, hero="nope")


def test_zh_locale_uses_chinese_fragments(spec):
    spec.data["meta"]["locale"] = "zh"
    text = P.design_prompt(spec)
    assert "思源黑体" in text and "Simplified Chinese" in text


def test_panel_paste_fix_regen(spec):
    assert '"Team Ranking"' in P.panel_prompt(spec, "teams")
    assert "4,512 pts" in P.panel_prompt(spec, "teams")
    assert "Image 2" in P.paste_back_prompt(spec, "trend")
    fix = P.fix_prompt(spec, ["Rank 5 unit is pts", "Date is 2026-10-18"])
    assert "1. Rank 5 unit is pts" in fix and "Liu*Qiang" in fix
    with pytest.raises(ValueError):
        P.fix_prompt(spec, [])
    regen = P.regen_prompt("a glowing orb", 0.85)
    assert regen.startswith("Recreate a glowing orb")
    assert "keep exact subject/composition/colors" in regen
    assert "PURE SOLID BLACK #000000 background, no gradient/floor/text/watermark/frame" in regen
    assert "fills ~85%" in regen and "nothing cropped" in regen


def test_save_prompt(spec):
    path = P.save_prompt(spec, "x", "hello")
    assert path == spec.workspace / "prompts" / "x.txt" and path.read_text() == "hello"


def test_format_data_shapes():
    assert P.format_data([1, 2]) == ["- 1", "- 2"]
    lines = P.format_data({"total": 10935, "items": [{"name": "A", "value": 1.5}]})
    assert "total: 10,935" in lines and "1  A  1.5" in lines
