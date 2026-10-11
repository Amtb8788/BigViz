# BigViz usage guide

Everything you need to go from `git clone` to a dashboard running on a wall. Read it top to
bottom the first time; after that, jump to the section you need.

[简体中文](USAGE.zh-CN.md) · [Back to README](../README.md)

**Contents**

1. [Prerequisites](#1-prerequisites)
2. [Run the demo in one minute](#2-run-the-demo-in-one-minute)
3. [Install](#3-install)
4. [Your first screen with an AI agent](#4-your-first-screen-with-an-ai-agent)
5. [CLI reference](#5-cli-reference)
6. [Work with the template](#6-work-with-the-template)
7. [The 3D digital-twin city](#7-the-3d-digital-twin-city)
8. [Build and deploy](#8-build-and-deploy)
9. [Troubleshooting](#9-troubleshooting)
10. [Develop BigViz itself](#10-develop-bigviz-itself)

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 20.19+ | the Vue 3 template (Vite 7) |
| Python | 3.10+ | the `bigviz` CLI |
| [uv](https://docs.astral.sh/uv/) | latest | installing / running the CLI (recommended) |
| An AI coding agent | Claude Code, Cursor, Codex, … | the skills (optional, the CLI works alone) |
| OpenAI-compatible Images API key | — | AI mockups and HD regen (optional) |
| Chromium for Playwright | — | `bigviz shot` screenshots (optional) |

Only Node is required to run the demo.

## 2. Run the demo in one minute

```bash
git clone https://github.com/Amtb8788/BigViz.git
cd BigViz/templates/vue3-echarts
npm install
npm run dev
```

| URL | Screen |
|---|---|
| <http://localhost:5173/> | 2D safety command center (ECharts) |
| <http://localhost:5173/#/city> | 3D smart-city operations center (three.js) |

If port 5173 is busy, Vite picks the next one; use the URL it prints. Both screens switch
between English and Chinese with the button in the top-right corner, and run on mock data from
`src/mock/`.

## 3. Install

### 3.1 The skills

**Claude Code** (inside a Claude Code session):

```
/plugin marketplace add Amtb8788/BigViz
/plugin install bigviz@bigviz
```

This installs six skills and three slash commands: `/bigviz`, `/bigviz-regen` and `/bigviz-qa`.

**Other agents** that follow the [Agent Skills](https://agentskills.io) standard: copy the
skill folders into the tool's skills directory.

```bash
git clone https://github.com/Amtb8788/BigViz
cp -r BigViz/plugins/bigviz/skills/* .agents/skills/     # or .cursor/skills/, ~/.codex/skills/
```

### 3.2 The CLI

```bash
# Install once, then use `bigviz` anywhere
uv tool install "git+https://github.com/Amtb8788/BigViz#subdirectory=cli"

# Or run without installing
uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz doctor

# Screenshots need the optional Playwright extra and a browser (one-time)
uv tool install --force --with-executables-from playwright \
  "bigviz[shot] @ git+https://github.com/Amtb8788/BigViz#subdirectory=cli"
playwright install chromium
```

Using pip instead: `pip install "git+https://github.com/Amtb8788/BigViz#subdirectory=cli"`.

### 3.3 The image provider

```bash
export BIGVIZ_API_KEY=...                          # required for probe / gen / edit / regen
export BIGVIZ_BASE_URL=https://api.openai.com/v1   # any OpenAI-compatible Images API or proxy
export BIGVIZ_MODEL=gpt-image-1
```

On Windows PowerShell use `$env:BIGVIZ_API_KEY = "..."`. Keep the key in your shell profile or
a secret manager, never in the repo. `.env` files are git-ignored and CI runs gitleaks.

### 3.4 Check your setup

```bash
bigviz doctor
```

It reports Python dependencies, Playwright, Chromium and the API variables, each with a fix
hint if something is missing.

## 4. Your first screen with an AI agent

### 4.1 Quick mode (default): 2–3 replies

```
/bigviz A smart-park operations dashboard: energy, access control, parking, alerts.
Deep tech blue, English.
```

| Turn | The agent does | You reply |
|---|---|---|
| 1 | Writes the full spec (6 panels, 4 KPIs, fictional data), shows a summary table | "OK" or what to change |
| 2 | Renders 4 mockups, counts text errors in each, recommends one | "Use #2" |
| 3 | Fixes text, cuts assets, builds the Vue page, typechecks | starts the dev server |

After you run `npm run dev`, the agent screenshots the page, overlays it on the mockup and
tells you what is left to polish.

### 4.2 Studio mode: every decision is yours

Say "studio mode". The agent then stops at four decision points: style shoot-out across
presets, hero A/B, final mockup, and per-panel refine.

### 4.3 Useful phrases

| You want | Say |
|---|---|
| Another style | "switch to editorial-dark" / "make it glassmorphism" |
| A 3D centre | "make the centre a 3D digital-twin city with clickable alerts" |
| Your own design | "I have a mockup at designs/foo.png, build from that" |
| Real data | "load the panels from /api/screen" |
| Fix one area | "the bottom-left panel is too empty, refine it" |
| Regenerate one asset | `/bigviz-regen center-hub` |
| Re-run QA | `/bigviz-qa http://localhost:5173/` |

### 4.4 No API key

The agent builds the page directly on the template with its bundled assets and lists which
images to replace later. If you have a mockup, it follows the bring-your-own path in
[5.3](#53-bring-your-own-mockup).

## 5. CLI reference

Every command accepts `--spec PATH`. By default it uses `./bigviz.yaml`, or the only
`bigviz/*/bigviz.yaml` under the current directory. Add `-v` for debug logs and `-h` to any
command for its full options.

### 5.1 Commands

| Stage | Command | What it does |
|---|---|---|
| Setup | `bigviz init <slug> [--preset P] [--locale en\|zh]` | Creates the workspace `bigviz/<slug>/` with a starter spec |
| | `bigviz doctor` | Checks dependencies, browser and API variables |
| | `bigviz probe [--sizes …]` | Sends tiny low-quality requests and records the real returned sizes in `.bigviz-probe.json` |
| Design | `bigviz prompt design [--variant P] [--hero KEY]` | Composes the full-screen mockup prompt into `prompts/` |
| | `bigviz prompt panel <id>` / `prompt paste <id>` | Refine one panel, then paste it back into the mockup |
| | `bigviz prompt fix` / `prompt regen <asset>` | Text-fix prompt; HD regen prompt for one asset |
| | `bigviz gen <prompt> --tag v1 [--n 4] [--quality high]` | Text → image into `designs/`, auto-named, with a JSON sidecar |
| | `bigviz edit <prompt> --image a.png[,b.png] --tag v2` | Image edit: text fix, panel paste-back, regen |
| | `bigviz sheet "<glob>" [-o out.png]` | Labelled contact sheet for comparing renders |
| Assets | `bigviz slice [--ids a,b]` | Crops `assets[]` boxes from `design.final` into `assets/placeholder/` (×2) |
| | `bigviz matte --ids a,b` or `matte SRC DST --method …` | Background removal: `unscreen`, `black`, `grabcut` or `none` |
| | `bigviz erase SRC DST --boxes x,y,w,h;…` | Removes baked-in text (inpaint + row interpolation) |
| | `bigviz regen [--ids …] [--jobs 3] [--dry-run]` | AI HD regeneration → black matte → trim → `assets/final/` |
| | `bigviz manifest` | Measures size, aspect and trim of every final asset |
| | `bigviz publish --app <dir> [--name View]` | Backs up, copies finals into the app, writes `assets.manifest.ts` |
| QA | `bigviz shot <url> [--dpr 2] [--frames 8] [--wait ms]` | Playwright screenshots or motion frames |
| | `bigviz overlay <shot> <design> [--alpha 0.5] [--diff]` | Overlays or diffs a screenshot against its mockup |

### 5.2 Full run with AI mockups

```bash
bigviz init my-screen --preset deep-tech-blue --locale en
cd bigviz/my-screen
bigviz probe

# 1. Edit bigviz.yaml: title, panels, kpis, data, hero, pitfalls (see guide-spec.md)

# 2. Design
bigviz prompt design                               # writes prompts/<file>.txt
bigviz gen prompts/<file>.txt --tag v1 --n 4
bigviz sheet "designs/*-v1-*.png" -o shots/v1-sheet.png
#    pick one → set design.final in bigviz.yaml
#    wrong text? bigviz prompt fix, then bigviz edit … --image designs/<final>.png --tag v2

# 3. Assets: measure each asset box in pixels of design.final → assets[] in bigviz.yaml
bigviz slice                                       # placeholders, unblock page dev now
bigviz matte --ids center-hub
bigviz regen --jobs 3
bigviz manifest
bigviz publish --app ../../my-app --name MyScreen

# 4. QA (start the dev server yourself first)
bigviz shot http://localhost:5173/ --dpr 2 -o shots/full.png
bigviz overlay shots/full.png designs/<final>.png --alpha 0.5 --diff
bigviz shot http://localhost:5173/ --frames 8 --interval 180 -o shots/motion.png
```

### 5.3 Bring your own mockup

1. `bigviz init my-screen`, then copy your image into `bigviz/my-screen/designs/`.
2. Fill `bigviz.yaml` from the image and set `design.final`.
3. Measure `assets[]`. Set `regen: false` on every asset if you have no key.
4. `bigviz slice && bigviz matte && bigviz manifest && bigviz publish --app …`

None of these steps call the image API.

### 5.4 Workspace layout

```
bigviz/<slug>/
├── bigviz.yaml          # the spec: single source of truth
├── prompts/             # every composed prompt, kept for reproducibility
├── designs/             # <slug>-<version>-<model>[-n].png + .json sidecar
├── assets/
│   ├── placeholder/     # straight crops ×2
│   ├── alpha/           # matted from the mockup
│   ├── regen/<id>/      # HD regenerations
│   └── final/           # publish-ready PNGs + manifest.json
├── shots/               # screenshots, overlays, contact sheets
└── backup/<timestamp>/  # automatic backup before every publish
```

`designs/`, `assets/`, `shots/` and `backup/` are git-ignored. Commit the spec and prompts.
Field-by-field spec docs: [guide-spec.md](guide-spec.md). Matting tips:
[guide-matting.md](guide-matting.md).

## 6. Work with the template

`templates/vue3-echarts` is the deliverable. Copy it as a new project, or copy its kits into
an existing app.

### 6.1 Scripts

```bash
npm install
npm run dev         # dev server with hot reload, http://localhost:5173
npm run typecheck   # vue-tsc --noEmit
npm run build       # typecheck + production build into dist/
npm run preview     # serve dist/ locally
```

### 6.2 Project layout

```
src/
├── App.vue              # hash routing: #/city → 3D city, anything else → example
├── api/                 # fetch + runtime validation (screen.ts, city.ts, validate.ts)
├── mock/                # example.json, city.json (served at /mock/*.json)
├── screen/              # 2D kit: BigScreen, ScreenPanel, ScreenChart, RankList, …
├── screen3d/            # 3D kit: ThreeStage, CityHero, procedural city
├── assets/bigviz/       # assets written by `bigviz publish`
└── views/
    ├── Example/         # 2D reference screen
    └── City/            # 3D reference screen
```

### 6.3 Connect real data

Create `.env.local` next to `package.json`:

```bash
VITE_API_URL=https://api.example.com/screen        # 2D example screen
VITE_CITY_API_URL=https://api.example.com/city     # 3D city screen
```

- The response must match the mock JSON shape. Start by copying `src/mock/*.json` from your
  backend.
- Validation lives in `src/api/screen.ts` and `src/api/city.ts`. A wrong shape fails with the
  exact field path instead of rendering `NaN`.
- Data refreshes every 60 s, pauses while the tab is hidden, and keeps the last good data on
  failure.
- Need auth headers? Replace the plain `fetch` with your app's request helper and keep the
  parser at the boundary.
- Changing the contract? Update `views/<Screen>/types.ts` and the parser together.

### 6.4 Text and language

UI strings live in `views/Example/i18n.ts` and `views/City/i18n.ts` (`en` / `zh`). The header
button toggles them. Data values (team names, places) are shown as the API returns them.

### 6.5 Theme and layout

- Colours are CSS variables in `src/screen/theme.css` (`--bv-bg0 … --bv-text`). They map to
  the preset palette keys.
- `BigScreen` lays out on a 1920×1080 stage, stretches to the container aspect (clamped 4:3 to
  32:9) and scales with CSS `zoom`, so text stays sharp at any size.
- Charts render at `zoom × devicePixelRatio`, so they stay crisp on 4K walls.
- Only `transform` and `opacity` animate. Every loop respects `prefers-reduced-motion`.

### 6.6 Add a new screen

1. Copy `views/Example/` to `views/MyScreen/`.
2. Run `bigviz publish --app <template> --name MyScreen` to generate its
   `assets.manifest.ts`.
3. Register the route in `App.vue`: `const ROUTES = { '#/city': CityScreen, '#/my': MyScreen }`.
4. Switch to `vue-router` when you have more than a few screens.

### 6.7 Embed in an existing admin app

1. Copy `src/screen/` (and `src/screen3d/` for 3D) as folders, and import `theme.css` once.
2. Give the screen a full-viewport wrapper: `.my-screen { position: fixed; inset: 0; z-index: 3000; }`
3. Use a blank layout for the route. Admin shells often add `height: calc(100% - 60px)`, padding
   or overflow to the page root, which crops the screen.

Details: [template README](../templates/vue3-echarts/README.md).

## 7. The 3D digital-twin city

Open `/#/city`. The centre is a live three.js scene generated in code: no models, no textures,
works offline.

### 7.1 Controls

| Action | Mouse / touch |
|---|---|
| Orbit | Left-drag |
| Pan | Right-drag, middle-drag or Shift + left-drag |
| Zoom | Scroll wheel |
| Fly to an alert | Click a beacon on the map, or an alert in the left list |
| Resume the tour | Leave it alone: the camera eases back into the auto-tour after ~12 s idle |

After a fly-to the camera holds on the alert for about 8 s, then resumes the tour. Zoom and
elevation are clamped so you can't fly under the ground or lose the city.

### 7.2 Turn it on in a spec

```yaml
hero:
  mode: three      # image (default) | three
  scene: city      # the only scene for now
  seed: 7          # same seed → same city layout
```

With the agent, add "3D city" or "digital twin" to your request. The mockup prompt then
describes the 3D city, and the cut list skips the hero image.

### 7.3 Use it in your own screen

```vue
<CityHero
  ref="city"
  :alerts="alerts"
  :focus-id="focusId"
  :seed="7"
  :fallback="fallbackImage"
  @select="(id) => (focusId = id)"
/>
```

`alerts` items are `{ id, label, level: 'info' | 'warn' | 'critical', x, z, value?, unit? }`.
`x` and `z` are map coordinates from -1 to 1. Call `city.value.flyTo(id)` to move the camera
from code.

Built-in safeguards: WebGL2, pixel ratio capped at 2, rendering pauses when the tab is hidden,
reduced motion renders one still frame, everything is disposed on unmount, and `fallback` is
shown if WebGL fails. More: [guide-3d.md](guide-3d.md).

## 8. Build and deploy

```bash
npm run build      # output in dist/
```

The build uses a relative base (`./`), so `dist/` works from any sub-path, a file share or a
plain static server (Nginx, IIS, S3, an intranet box). Mock JSON is copied to `dist/mock/`;
remove it once your real API is wired up.

- **GitHub Pages.** `.github/workflows/pages.yml` publishes the template on every push to
  `main` that touches it. Enable it once in *Settings → Pages → Source: GitHub Actions*.
- **Wall displays.** Open the screen in kiosk mode, for example
  `chrome --kiosk --app=https://your-host/screen/`. CSS `zoom` needs Chromium, Safari or
  Firefox 126+.
- **Security.** The template is a static front-end with no auth. If the data is sensitive,
  put it behind your SSO or reverse-proxy auth, and protect the API it calls.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails or Vite won't start | Check `node -v` is 20.19+ |
| Port 5173 shows a different app | Another dev server owns it. Use the URL Vite prints, or `npm run dev -- --port 5180` |
| `BIGVIZ_API_KEY is not set` | Export it in the same shell that runs the CLI or your agent |
| Mockups are smaller than 1920×1080 | Expected: APIs cap resolution. `bigviz probe` records real sizes; text is code and assets are regenerated in HD |
| Garbled text in mockups | List the strings under `pitfalls`, batch `--n 4`–`7`, pick the best, run one `prompt fix` + `edit` pass |
| Halo or dark fringe around a matted asset | Try `--method black` for objects on black, tune `--gain` / `--feather`; see [guide-matting.md](guide-matting.md) |
| `bigviz shot` says Playwright or Chromium is missing | Install the `shot` extra and run `playwright install chromium` ([3.2](#32-the-cli)) |
| 3D screenshot is blank | Headless WebGL is slow: add `--wait 6000` or more |
| Panel shows an error with a field path | Your API shape differs from the mock. Fix the response or the parser in `src/api/` |
| Screen is cropped or 60 px short inside an admin app | Host layout styles leak in; see [6.7](#67-embed-in-an-existing-admin-app) |
| 3D city shows a static image | WebGL is unavailable (old GPU driver, remote desktop). That's the fallback working |

Still stuck? Run with `-v`, then open an issue with the command, output and `bigviz doctor`
result. Remove keys from logs first.

## 10. Develop BigViz itself

```bash
# CLI
cd cli
uv sync
uv run pytest

# Template
cd templates/vue3-echarts
npm ci
npm run typecheck
npm run build
```

Contributions follow [CONTRIBUTING.md](../CONTRIBUTING.md): Conventional Commits, one topic
per PR, tests for CLI changes, screenshots for UI changes, original work only. Contracts
between CLI, template and skills are in [ARCHITECTURE.md](ARCHITECTURE.md). Change one, update
all consumers in the same PR.
