"""Panel catalog: CLI and template agree, every type validates and reaches the prompt."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from bigviz import catalog as C
from bigviz import prompts as P
from bigviz.spec import PANEL_TYPES

TS_CATALOG = Path(__file__).parents[2] / "templates/vue3-echarts/src/kit/2d/catalog.ts"


def test_spec_uses_catalog_types():
    assert PANEL_TYPES == C.PANEL_TYPES


def test_template_catalog_matches():
    text = TS_CATALOG.read_text(encoding="utf-8")
    body = text[text.index("PANEL_CATALOG = {"):text.index("} as const")]
    ts_types = tuple(re.findall(r"^\s*'?([a-z-]+)'?:", body, re.M))
    assert ts_types == C.PANEL_TYPES


def test_every_kind_has_look_and_component():
    for name, kind in C.CATALOG.items():
        assert kind.look.strip() and kind.component.strip(), name


@pytest.mark.parametrize("ptype", ["gauge", "liquid", "radar", "funnel", "map", "scroll-table", "alerts", "flip"])
def test_new_types_validate_and_describe(spec, ptype):
    spec.data["panels"][0]["type"] = ptype
    text = P.design_prompt(spec)
    assert C.CATALOG[ptype].look in text
    assert C.CATALOG[ptype].look in P.panel_prompt(spec, spec["panels"][0]["id"])


def test_unknown_look_falls_back():
    assert C.look("sparkline") == "sparkline chart"
