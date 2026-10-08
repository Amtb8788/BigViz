"""Compose image-model prompts from a spec and its preset.

Design prompt structure (fixed order): frame rules, positioning, material,
visual system (palette hex + panel style), typography (marked most important),
layout (every panel with its exact data), on-screen text, pitfalls, avoid.
Section headings and instructions are English; on-screen text and the
locale-sensitive preset fragments follow `meta.locale`.
"""

from __future__ import annotations

from math import gcd
from pathlib import Path
from typing import Any

from bigviz.spec import PALETTE_KEYS, Spec, load_preset, localised

PALETTE_ROLES = {
    "bg0": "background base", "bg1": "background lift", "primary": "primary",
    "accent": "accent / highlight", "warn": "warning / exchange", "ok": "growth / success",
    "violet": "secondary series", "text": "text",
}
TEXT_LANG = {
    "en": "All on-screen text is English.",
    "zh": "All on-screen text is Simplified Chinese (numbers in Arabic digits), "
          "rendered exactly as quoted below.",
}
FRAME_RULE = (
    "Output only the screen itself as a flat, straight-on front view of the UI: no monitor, "
    "no bezel, no meeting room, no perspective angle, no device or mock-up frame."
)
NO_NAV_RULE = (
    "There is no bottom navigation bar, no buttons and no menu at the bottom; the side "
    "columns and the center scene extend all the way to the bottom edge."
)
NAV_RULE = "A slim bottom navigation bar is allowed along the bottom edge."
TEXT_RULE = (
    "Every word and number on screen must match the text in this prompt character for "
    "character: crisp, legible, no garbled glyphs, no typos. Do not add any paragraph text "
    "that is not listed here."
)


def fmt(v: Any) -> str:
    """Human number formatting: 128560 -> '128,560'; strings pass through."""
    if isinstance(v, bool):
        return str(v).lower()
    if isinstance(v, int):
        return f"{v:,}"
    if isinstance(v, float):
        return f"{int(v):,}" if v.is_integer() else f"{v:,}"
    return str(v)


def _aspect(w: int, h: int) -> str:
    g = gcd(w, h)
    return f"{w // g}:{h // g}"


def _row(d: dict, idx: int | None = None) -> str:
    """One data row: rank. name · sub-fields  value unit (extra: x)."""
    head = [fmt(d[k]) for k in ("name", "label", "title") if k in d]
    sub = [fmt(d[k]) for k in ("group", "sub", "category") if k in d]
    value = fmt(d["value"]) + (f" {d['unit']}" if d.get("unit") else "") if "value" in d else ""
    used = {"name", "label", "title", "group", "sub", "category", "value", "unit", "rank"}
    extra = [f"{k}: {fmt(v) if not isinstance(v, list) else ', '.join(map(fmt, v))}"
             for k, v in d.items() if k not in used]
    rank = d.get("rank", idx)
    text = " · ".join(head + sub)
    parts = [p for p in (f"{rank}" if rank is not None else "", text, value) if p]
    line = "  ".join(parts)
    return line + (f" ({'; '.join(extra)})" if extra else "")


def format_data(data: Any) -> list[str]:
    """Render panel data as prompt lines; handles axes+series, item lists and plain maps."""
    if isinstance(data, list):
        return [_row(d, i + 1) if isinstance(d, dict) else f"- {fmt(d)}" for i, d in enumerate(data)]
    if not isinstance(data, dict) or not data:
        return []
    lines: list[str] = []
    if "x" in data:
        lines.append("X axis, in order: " + ", ".join(map(fmt, data["x"])))
    for s in data.get("series", []) or []:
        extra = [f"{k}: {fmt(v)}" for k, v in s.items() if k not in ("name", "values")]
        lines.append(f'- series "{s.get("name", "")}"' + (f" ({'; '.join(extra)})" if extra else "")
                     + ": " + ", ".join(map(fmt, s.get("values", []))))
    for key, value in data.items():
        if key in ("x", "series"):
            continue
        if isinstance(value, list) and value and all(isinstance(v, dict) for v in value):
            ranked = key in ("items", "rows", "ranking")
            lines.append(f"{key}:")
            lines += [_row(v, i + 1 if ranked else None) for i, v in enumerate(value)]
        elif isinstance(value, list):
            lines.append(f"{key}: " + ", ".join(map(fmt, value)))
        elif isinstance(value, dict):
            lines.append(f"{key}: " + "; ".join(f"{k} {fmt(v)}" for k, v in value.items()))
        else:
            lines.append(f"{key}: {fmt(value)}")
    return lines


def _q(s: str) -> str:
    return f'"{s}"'


def _hero_text(spec: Spec, hero: str | None) -> str:
    h = spec["hero"]
    key = hero or h["concept"]
    if hero and hero not in h["variants"]:
        raise KeyError(f"hero variant '{hero}' not in spec.hero.variants "
                       f"({', '.join(h['variants']) or 'none defined'})")
    return h["variants"].get(key, key)


def _layout(spec: Spec, hero: str | None) -> list[str]:
    meta, layout = spec["meta"], spec["layout"]
    cols = layout["columns"]
    names = ["left", "center", "right"] if len(cols) == 3 else [f"column {i + 1}" for i in range(len(cols))]
    out = ["Grid: " + ", ".join(f"{n} {c:g}%" for n, c in zip(names, cols)) + " of the width."]
    head = [f"centered large main title {_q(meta['title'])}"]
    if meta["project"]:
        head.append(f"top-left project name {_q(meta['project'])}")
    if layout["header"]["clock"]:
        head.append("top-right live date and time, e.g. \"2026-10-18 14:32:08\"")
    if layout["header"]["weather"]:
        head.append("a small weather readout next to the clock")
    out.append("Header: " + "; ".join(head) + ".")
    if spec["kpis"]:
        out.append(f"KPI row ({len(spec['kpis'])} cards in one row at the top of the center column):")
        for k in spec["kpis"]:
            icon = f"3D {k['icon']} icon | " if k["icon"] else ""
            unit = f" {k['unit']}" if k["unit"] else ""
            delta = f" | {k['delta']}" if k["delta"] else ""
            out.append(f"- {icon}{_q(k['label'])} | {fmt(k['value'])}{unit}{delta}")
    hero_text = _hero_text(spec, hero)
    if hero_text:
        out.append(f"Center hero visual (focal point of the whole screen, no text on it): {hero_text}.")
        for n in spec["hero"]["nodes"]:
            icon = f"3D {n['icon']} icon, " if n["icon"] else ""
            val = f": {fmt(n['value'])}{(' ' + n['unit']) if n['unit'] else ''}" if n["value"] is not None else ""
            out.append(f"- hero node ({icon}label {_q(n['label'])}){val}")
    for col in ("left", "center", "right"):
        panels = [p for p in spec["panels"] if p["column"] == col]
        if not panels:
            continue
        out.append(f"{col.capitalize()} column, top to bottom:")
        for i, p in enumerate(panels, 1):
            out.append(f"{i}. Panel {_q(p['title'])} ({p['type']} chart)")
            out += [f"   {line}" for line in format_data(p["data"])]
            if p["notes"]:
                out.append(f"   Notes: {p['notes']}")
    out.append(NAV_RULE if layout["bottom_nav"] else NO_NAV_RULE)
    return out


def design_prompt(spec: Spec, variant: str | None = None, hero: str | None = None) -> str:
    """Full-screen mockup prompt. `variant` = preset name (style shoot-out), `hero` = hero key."""
    preset = load_preset(variant) if variant else spec.preset
    palette = {**preset["palette"], **spec["style"]["palette"]}
    fonts = {**preset["fonts"], **spec["style"]["fonts"]}
    loc, p, meta = spec.locale, preset["prompt"], spec["meta"]
    w, h = meta["canvas"]["width"], meta["canvas"]["height"]
    pal = "\n".join(f"- {k} {palette[k]}: {PALETTE_ROLES[k]}" for k in PALETTE_KEYS)
    sections = [
        f"Design a {w}x{h} ({_aspect(w, h)} landscape) data-visualisation big-screen UI mockup "
        f"titled {_q(meta['title'])}. {FRAME_RULE}",
        "## Positioning\n" + localised(p["positioning"], loc),
        "## Material and light\n" + localised(p["material"], loc),
        "## Visual system\nPalette (use these exact hex colours):\n" + pal + "\n"
        + localised(p["panel"], loc) + f"\nFonts: UI text {fonts['ui']}; numbers {fonts['number']}.",
        "## Typography (MOST IMPORTANT)\n" + localised(p["typography"], loc) + "\n" + TEXT_LANG[loc],
        "## Layout\n" + "\n".join(_layout(spec, hero)),
        "## On-screen text\n" + TEXT_RULE,
    ]
    if spec["pitfalls"]:
        sections.append("## Pitfalls (render these strings exactly, glyph by glyph)\n"
                        + "\n".join(f"- {_q(s)}" for s in spec["pitfalls"]))
    sections.append("## Avoid\n" + localised(p["avoid"], loc) + "; monitor or mock-up frame"
                    + ("" if spec["layout"]["bottom_nav"] else "; bottom navigation bar"))
    return "\n\n".join(sections) + "\n"


def _panel(spec: Spec, panel_id: str) -> dict:
    for p in spec["panels"]:
        if p["id"] == panel_id:
            return p
    raise KeyError(f"no panel with id '{panel_id}' in spec.panels")


def panel_prompt(spec: Spec, panel_id: str) -> str:
    """Refine one panel in place on the reference mockup; everything else stays identical."""
    p = _panel(spec, panel_id)
    loc, pre = spec.locale, spec.preset["prompt"]
    data = "\n".join(format_data(p["data"])) or "(no data listed)"
    return "\n\n".join([
        f"Use the reference image (the full dashboard mockup) as the base and edit only the inside "
        f"of the {p['column']} column panel titled {_q(p['title'])}. Every other area (header, KPI "
        f"cards, hero, all other panels) stays exactly as it is: same position, size, text, colours "
        f"and light. Keep the panel frame and its title bar unchanged. {FRAME_RULE}",
        f"## New panel content ({p['type']} chart)\n{data}" + (f"\nNotes: {p['notes']}" if p["notes"] else ""),
        "## Style\n" + localised(pre["panel"], loc)
        + "\nThe panel's glow and detail level match the rest of the screen and never outshine the hero.",
        "## Typography (MOST IMPORTANT)\n" + localised(pre["typography"], loc) + "\n" + TEXT_LANG[loc]
        + "\nText size matches the list text of the other panels.",
        "## On-screen text\n" + TEXT_RULE,
        "Output the complete full-screen dashboard.",
    ]) + "\n"


def paste_back_prompt(spec: Spec, panel_id: str) -> str:
    """Merge a separately refined panel (image 2) back into the full mockup (image 1)."""
    p = _panel(spec, panel_id)
    return (
        f"Image 1 is the full dashboard mockup. Image 2 is a refined version of its panel "
        f"{_q(p['title'])}. Replace that panel in image 1 with the content of image 2, scaled to the "
        f"panel's exact position and size in image 1. Keep everything else in image 1 pixel-identical: "
        f"layout, colours, all other text and light. Match the panel's light, contrast and line "
        f"weights to its neighbours so the seam is invisible. {FRAME_RULE} Keep every on-screen "
        f"string exactly as shown in image 2. Output the complete full-screen dashboard.\n"
    )


def fix_prompt(spec: Spec, fixes: list[str]) -> str:
    """Targeted text / detail corrections on an existing mockup."""
    if not fixes:
        raise ValueError("fix prompt needs at least one fix (use --fix or --from)")
    meta = spec["meta"]
    w, h = meta["canvas"]["width"], meta["canvas"]["height"]
    lines = "\n".join(f"{i}. {f}" for i, f in enumerate(fixes, 1))
    pit = ("\nRender these strings exactly: " + ", ".join(map(_q, spec["pitfalls"]))) if spec["pitfalls"] else ""
    return (
        f"Keep this dashboard's overall layout, colours, every chart, icon, KPI card and number exactly "
        f"as they are. Keep the {_aspect(w, h)} landscape frame with content filling the whole canvas, "
        f"no empty dark band at the bottom. Make only the following corrections; leave every other area "
        f"untouched:\n{lines}\nDo not add any other text.{pit}\n"
    )


def regen_prompt(subject: str, fill: float = 0.85) -> str:
    """HD regeneration of one asset on pure black (the black is keyed out afterwards)."""
    return (
        f"Recreate {subject} from the reference image as a single high-resolution, ultra-sharp render; "
        f"keep exact subject/composition/colors, only increase detail and crispness. "
        f"PURE SOLID BLACK #000000 background, no gradient/floor/text/watermark/frame. "
        f"Perfectly centered; subject fills ~{round(fill * 100)}% of the canvas, nothing cropped. "
        f"Clean edges, premium 3D render, soft studio lighting, no noise, no blur.\n"
    )


def save_prompt(spec: Spec, name: str, text: str) -> Path:
    """Write a composed prompt to `prompts/<name>.txt` (kept for reproducibility)."""
    path = spec.dir("prompts") / f"{name}.txt"
    path.write_text(text, encoding="utf-8")
    return path
