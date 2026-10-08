# BigViz Architecture Contract

Single source of truth for every part of the repo (CLI, template, skills, docs).
If you change a name, path, command or field here, update all consumers.

## 1. Repository layout

```
bigviz/
├── .claude-plugin/marketplace.json        # Claude Code marketplace entry
├── plugins/bigviz/
│   ├── .claude-plugin/plugin.json
│   ├── commands/                          # slash commands (/bigviz …)
│   └── skills/                            # Agent Skills standard (SKILL.md folders)
│       ├── bigviz/                        # orchestrator: one-line idea → finished screen
│       ├── bigviz-brief/                  # idea → bigviz.yaml
│       ├── bigviz-design/                 # mockups: style shoot-out, hero A/B, fixes, panel refine
│       ├── bigviz-assets/                 # slice, matte, AI regen (HD), manifest, publish
│       ├── bigviz-build/                  # Vue3 page from template + spec + manifest
│       └── bigviz-qa/                     # screenshots, overlay vs mockup, motion frames, checks
├── cli/                                   # Python package `bigviz` (PyPI), entry point `bigviz`
│   ├── pyproject.toml
│   ├── src/bigviz/
│   │   ├── __main__.py, cli.py            # argparse subcommands
│   │   ├── spec.py                        # load/validate bigviz.yaml, resolve paths
│   │   ├── provider.py                    # OpenAI-compatible Images API (stdlib urllib)
│   │   ├── prompts.py                     # compose prompts from spec + preset
│   │   ├── presets/*.yaml                 # visual systems (palette, fonts, prompt fragments)
│   │   ├── matte.py                       # unscreen / black / grabcut / inpaint / feather
│   │   ├── slice.py, regen.py, manifest.py, publish.py, sheet.py, shot.py
│   │   └── log.py                         # generation records (JSON sidecars)
│   └── tests/                             # matte regression on synthetic images
├── templates/vue3-echarts/                # standalone Vite + Vue 3 + TS + ECharts screen
├── examples/safety-points/                # anonymised end-to-end example (spec + screenshots)
├── docs/                                  # ARCHITECTURE.md (this), guides
├── README.md, README.zh-CN.md, LICENSE (MIT), CONTRIBUTING.md
└── .github/workflows/ci.yml
```

## 2. Workspace layout (inside the user's project)

`bigviz init <slug>` creates:

```
bigviz/<slug>/
├── bigviz.yaml                 # the spec
├── prompts/                    # composed prompt text, one file per shot (kept for reproducibility)
├── designs/                    # <slug>-<version>-<model>[-n].png + same-name .json sidecar
├── assets/
│   ├── placeholder/            # straight crops ×2 (unblock page dev immediately)
│   ├── alpha/                  # matted from mockup
│   ├── regen/<id>/             # AI HD regenerations (ref.png + outputs)
│   └── final/                  # publish-ready PNGs + manifest.json
├── shots/                      # QA screenshots, overlays, motion contact sheets
└── backup/<timestamp>/         # automatic backup before every publish
```

Published assets go to `<app>/src/assets/bigviz/<slug>/` plus a generated
`<app>/src/views/<Name>/assets.manifest.ts`.

## 3. CLI commands (`bigviz <cmd>`)

All commands take `--spec PATH` (default: `./bigviz.yaml` or the only `bigviz/*/bigviz.yaml`).
Exit code 0 on success; human-readable output; `--json` for machine output where useful.

| Command | Purpose |
|---|---|
| `init <slug> [--preset deep-tech-blue] [--locale en]` | scaffold workspace + starter spec |
| `doctor` | check Python deps, Playwright browser, API env vars |
| `probe [--sizes 1024x1024,1536x1024,2048x1152]` | request tiny low-quality images, record real returned sizes into `.bigviz-probe.json` |
| `prompt design [--variant <preset>] [--hero key]` / `prompt panel <id>` / `prompt paste <id>` / `prompt fix [--fix …]` / `prompt regen <asset>` | print/save composed prompt (`--variant` swaps the preset for a style shoot-out; `--hero` picks a `hero.variants` key) |
| `gen <prompt-file> --tag <version> [--n 1] [--size] [--quality high] [--model]` | text→image into `designs/`, auto-named, sidecar JSON |
| `edit <prompt-file> --image a.png[,b.png] --tag <version> [...]` | image edit (fix / panel paste-back / regen) |
| `sheet <glob> [--cols 4] [--bg #081E56] [-o out.png]` | labelled contact sheet for comparison or QA |
| `slice [--ids a,b]` | crop `assets[]` boxes from `design.final` → `assets/placeholder/` (LANCZOS ×2) |
| `matte <src> <dst> --method unscreen\|black\|grabcut [--feather …]` or `matte --ids …` (uses spec) | background removal |
| `erase <src> <dst> --boxes x,y,w,h;…` | remove baked-in text (inpaint + row interpolation) |
| `regen [--ids …] [--jobs 3]` | composite ref on black → `edit` with regen prompt → black matte → trim → `assets/final/` |
| `manifest` | measure every final asset: size, aspect, trim ratios → `assets/final/manifest.json` |
| `publish --app <dir> [--name ViewName]` | backup, copy finals into app, write `assets.manifest.ts` |
| `shot <url> [--viewport 1920x1080] [--dpr 2] [--selector …] [--frames 8 --interval 180] [--login-script f.py] [-o …]` | Playwright screenshots / motion frames |
| `overlay <shot.png> <design.png> [--alpha 0.5] [--diff]` | overlay or diff screenshot against mockup |

Provider env vars: `BIGVIZ_API_KEY` (required for gen/edit/regen/probe), `BIGVIZ_BASE_URL`
(default `https://api.openai.com/v1`), `BIGVIZ_MODEL` (default `gpt-image-1`). Never read keys
from files committed to the repo. Never print the key.

## 4. Spec: `bigviz.yaml` (version 1)

```yaml
version: 1
meta:
  slug: safety-points            # kebab-case, used in file names
  title: Safety Points Data Center
  project: Demo Tunnel Project   # shown top-left on the screen
  locale: en                     # en | zh  (language of on-screen text)
  canvas: { width: 1920, height: 1080 }
style:
  preset: deep-tech-blue         # presets/<name>.yaml
  palette: {}                    # optional overrides: bg0 bg1 primary accent warn ok violet text
  fonts: {}                      # optional overrides: ui, number
layout:
  columns: [24, 52, 24]          # percent
  header: { clock: true, weather: false }
panels:                          # order = reading order; column: left|center|right
  - id: trend
    column: left
    title: Points Trend
    type: line                   # line|bar|pie|ring|rank|podium|kpi|table|custom
    data: { x: [Mon, Tue], series: [{ name: Earned, values: [120, 98] }] }
    notes: optional free text for the designer prompt
hero:                            # center visual
  concept: shield                # free text; variants below for A/B
  variants: { shield: "...", core: "...", badge: "..." }
  nodes: [{ label: Safety Check, icon: helmet }]
kpis: [{ label: Total Points, value: 128560, unit: pts, icon: coins }]
pitfalls: ["Rebar Team 1", "Liu*Qiang"]  # exact strings the model tends to garble
design:
  versions:                       # human log of iterations (free text)
    - { tag: v1, note: restrained editorial }
  final: designs/safety-points-v5-gpt-image-1.png   # picked mockup, path relative to workspace
assets:                           # cut list; units = pixels of design.final
  - id: center-hub
    box: [640, 350, 375, 340]      # x, y, w, h
    matte: unscreen                # none|unscreen|black|grabcut
    erase: []                      # boxes of baked-in text to inpaint before matting
    regen: { subject: "3D glowing safety shield on a holographic pedestal", fill: 0.85 }
    target: 1000                   # longest edge of final PNG
    use: CenterHub                 # component that consumes it (documentation only)
```

Optional extras accepted by the validator: `layout.bottom_nav` (default `false`; mockups
have no bottom nav unless set), `hero.nodes[].value` / `.unit`, `kpis[].delta` (e.g. `"+3.2% MoM"`).
Preset prompt fragments may be a plain string or `{ en, zh }`, chosen by `meta.locale`.

Rules: unknown keys are errors (`bigviz` prints the path); `assets[].box` must lie inside
`design.final`; `regen: false` skips regeneration (final = matted alpha, resized).
Quote YAML flow-mapping values that contain commas (`note: "a, b"`).

## 5. Preset format (`cli/src/bigviz/presets/<name>.yaml`)

```yaml
name: deep-tech-blue
label: Deep Tech Blue
palette: { bg0: "#020B1F", bg1: "#06173A", primary: "#1E7BFF", accent: "#3FD0FF",
           warn: "#FFB547", ok: "#2EE6B6", violet: "#8A7BFF", text: "#FFFFFF" }
fonts: { ui: "Inter, 'Source Han Sans', 'Microsoft YaHei', sans-serif", number: "'DIN Alternate', Inter, sans-serif" }
prompt:
  positioning: ...   # paragraph
  material: ...
  panel: ...
  typography: ...    # the "most important" text-rendering paragraph
  avoid: ...
```

Ship at least: `deep-tech-blue` (default, CN command-center style), `editorial-dark`
(Bloomberg/Linear restraint), `aurora-glass` (light-on-dark glassmorphism, colourful accents).

## 6. Template contract (`templates/vue3-echarts`)

- Vite + Vue 3 + TS + ECharts 5; no UI library; `npm create`-style copy, no framework coupling.
- `src/screen/` reusable kit: `BigScreen.vue` (1920×1080 base, CSS `zoom`, aspect clamp 4/3–32/9),
  `ScreenPanel.vue`, `ScreenChart.vue` (devicePixelRatio = zoom × DPR, rounded 0.5, max 4),
  `RankList.vue`, `CountUp.vue`, `KpiCards.vue`, `HeroHub.vue`, `motion.ts`
  (`ENTRANCE` timeline, `useVisibleInterval`, `useReducedMotion`).
- `src/views/Example/` consumes `assets.manifest.ts` + `src/mock/example.json`.
- Theme tokens are CSS custom properties generated from the spec palette (`src/screen/theme.css`).
- Only animate `transform` / `opacity`; every looped effect has a reduced-motion fallback.

## 7. Licensing & hygiene

- MIT. Everything in the repo is original work written for BigViz.
- Never vendor third-party prompt libraries or scripts of unclear licence.
- Example data is fictional. No API keys, no real names, no customer project names.
