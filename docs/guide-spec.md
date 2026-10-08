# Spec reference: `bigviz.yaml` (version 1)

The spec drives every phase: prompts, slicing, matting, regen, publish and the page data.
Unknown keys are errors; `bigviz` prints the offending path. A full example lives in
[examples/safety-points/bigviz.yaml](../examples/safety-points/bigviz.yaml).

## Annotated spec

```yaml
version: 1                       # required, always 1

meta:
  slug: safety-points            # kebab-case; used in file names and the asset folder
  title: Safety Points Data Center   # main title, top centre of the screen
  project: Demo Tunnel Project   # shown top-left
  locale: en                     # en | zh: language of on-screen text and prompt wording
  canvas: { width: 1920, height: 1080 }   # base design size of the page

style:
  preset: deep-tech-blue         # cli/src/bigviz/presets/<name>.yaml
  palette: {}                    # optional overrides: bg0 bg1 primary accent warn ok violet text
  fonts: {}                      # optional overrides: ui, number

layout:
  columns: [24, 52, 24]          # left / center / right widths in percent
  header: { clock: true, weather: false }
  bottom_nav: false              # optional; mockups get no bottom nav bar unless true

panels:                          # order = reading order
  - id: trend                    # unique, kebab-case; used by `prompt panel <id>`
    column: left                 # left | center | right
    title: Points Trend          # exact on-screen title
    type: line                   # line|bar|pie|ring|rank|podium|kpi|table|custom
    data:                        # exact data; goes into the prompt and the page mock
      x: [Mon, Tue]
      series: [{ name: Earned, values: [120, 98] }]
    notes: optional free text for the designer prompt

hero:                            # the center visual
  concept: shield                # key into variants, or free text
  variants:                      # 2-3 concepts for the hero A/B
    shield: "..."
    core: "..."
    badge: "..."
  nodes:                         # satellites around the hero; value/unit optional
    - { label: Safety Check, icon: helmet, value: 1286, unit: times }

kpis:                            # top KPI cards; delta optional
  - { label: Total Points, value: 128560, unit: pts, icon: coins, delta: "+3.2% MoM" }

pitfalls:                        # exact strings the model tends to garble
  - "Rebar Team 1"
  - "Liu*Qiang"

design:
  versions:                      # human log of iterations (free text)
    - { tag: v1, note: restrained editorial }
  final: designs/safety-points-v5-gpt-image-1.png   # picked mockup, relative to workspace

assets:                          # cut list; units = pixels of design.final
  - id: center-hub
    box: [640, 350, 375, 340]    # x, y, w, h; must lie inside design.final
    matte: unscreen              # none|unscreen|black|grabcut
    erase: []                    # boxes of baked-in text to inpaint before matting
    regen:                       # or `false` to skip (final = matted alpha, resized)
      subject: "3D glowing safety shield on a holographic pedestal"
      fill: 0.85                 # share of the canvas the object should fill
    target: 1000                 # longest edge of the final PNG, in pixels
    use: CenterHub               # consuming component (documentation only)
```

## Field notes

### meta
- `slug` names the workspace (`bigviz/<slug>/`), design files and the published folder
  `<app>/src/assets/bigviz/<slug>/`.
- `canvas` is the page's base size, not the image size. Mockups come back at whatever
  size the API returns; run `bigviz probe` to find out.

### style
- Presets ship with the CLI: `deep-tech-blue` (default), `editorial-dark`, `aurora-glass`.
- `palette` overrides feed both the prompt and the template's `theme.css` tokens.

### panels
- `type` picks the component family in the template; `custom` means hand-built.
- `data` is free-form per type. Use exact values and units; they are copied verbatim into
  the prompt. Common shapes: `x` + `series` for line/bar, `items` of `{ name, value }` for
  pie/ring/rank/podium.
- Keep `notes` to styling hints. Data in `notes` is not validated.

### hero
- `concept` selects the default variant; `bigviz prompt design --hero <key>` swaps only the
  hero section for an A/B.
- `nodes` are the orbiting labels; keep labels short.

### pitfalls
List strings that are long, CJK, masked (`Liu*Qiang`), near-duplicates, units, dates.
The prompt emphasises them and the design skill checks them one by one.

### design
- `versions` is for humans; the CLI does not read it.
- `final` must exist before `slice`, `matte`, `regen` and asset box validation.

### assets
- Only 3D icons, the hero and podium bases. Panels, text and charts are code.
- Merge overlapping objects into one asset.
- `erase` is a list of `[x, y, w, h]` boxes in `design.final` pixels.
- After `regen`, the final aspect may differ from `box`. The page reads geometry from
  `assets.manifest.ts`, never from `box`.

See [matting guide](guide-matting.md) for choosing `matte`.
