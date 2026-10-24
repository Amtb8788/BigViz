"""Panel catalog: every `panels[].type` the template can build, and how to draw it.

One entry per type. `look` goes into mockup prompts so the image model draws something the
Vue kit can reproduce; `component` is what `bigviz-build` maps it to. Keep this table in sync
with the template's `src/kit/2d/catalog.ts` (a test checks the type lists match).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PanelKind:
    look: str
    component: str


CATALOG: dict[str, PanelKind] = {
    "line": PanelKind(
        "line chart: smooth glowing line(s) with soft area fill, thin axes, month or time labels",
        "ScreenChart (line option)"),
    "bar": PanelKind(
        "bar chart: vertical gradient bars with value labels on top, thin axes",
        "ScreenChart (bar option)"),
    "pie": PanelKind(
        "pie chart: a few slices with a legend beside it",
        "ScreenChart (pie option)"),
    "ring": PanelKind(
        "donut ring chart: thick ring segments, total in the middle, legend with percentages",
        "ScreenChart (pie option, inner radius)"),
    "rank": PanelKind(
        "ranking list: numbered rows (1 2 3 highlighted), name, thin progress bar, value on the right",
        "RankList"),
    "podium": PanelKind(
        "three-step podium for the top three, a short ranked list below",
        "Podium + RankList"),
    "kpi": PanelKind(
        "KPI cards: small icon, label, large number with unit, up/down change",
        "KpiCards + CountUp"),
    "gauge": PanelKind(
        "ring gauge: a 260-degree arc track with a glowing progress arc and tick marks, "
        "one large number with unit in the centre, caption under it",
        "ScreenChart (gaugeOption)"),
    "liquid": PanelKind(
        "liquid-fill ball: a glowing circle with water inside at the given level, two soft waves "
        "on the surface, percentage in the centre",
        "LiquidFill"),
    "radar": PanelKind(
        "radar chart: polygon grid with axis names around it, one or two filled translucent "
        "shapes, small legend below",
        "ScreenChart (radarOption)"),
    "funnel": PanelKind(
        "funnel: stacked trapezoid stages narrowing downwards, each with name, value and "
        "conversion percentage on the right",
        "ScreenChart (funnelOption)"),
    "map": PanelKind(
        "region map: flat outline map of the area with glowing borders, regions shaded by value, "
        "rippling dots at sites and curved flylines between them, a small legend in a corner",
        "GeoMap"),
    "scroll-table": PanelKind(
        "scrolling table: a header row in accent colour, five zebra-striped rows, status pills "
        "in one column",
        "ScrollTable"),
    "alerts": PanelKind(
        "live alert feed: stacked rows with a coloured left edge (red alarm, amber warning, "
        "blue info), level tag, title, source and time",
        "AlertFeed"),
    "flip": PanelKind(
        "flip counter: each digit in its own dark tile with a split line across the middle, "
        "thousands separators between tiles, caption above",
        "FlipNumber"),
    "table": PanelKind("static table with a header row and a few rows", "local component"),
    "custom": PanelKind("custom panel content as described in the notes", "local component"),
}

PANEL_TYPES: tuple[str, ...] = tuple(CATALOG)


def look(panel_type: str) -> str:
    """Visual description for a mockup prompt; unknown types fall back to a plain label."""
    kind = CATALOG.get(panel_type)
    return kind.look if kind else f"{panel_type} chart"
