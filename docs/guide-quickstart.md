# Quick start

From one sentence to a running Vue 3 big screen.

## 1. Install

Claude Code:

```
/plugin marketplace add Amtb8788/BigViz
/plugin install bigviz@bigviz
```

Other agents that support the Agent Skills standard: copy `plugins/bigviz/skills/*` into your
tool's skills folder (for example `.agents/skills/`, `.cursor/skills/` or `~/.codex/skills/`).
Check your tool's docs for the exact path.

The CLI is a Python package. Install it with [uv](https://docs.astral.sh/uv/), or run it
without installing:

```bash
uv tool install "git+https://github.com/Amtb8788/BigViz#subdirectory=cli"
# or, no install:
uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz doctor
```

## 2. Configure the image provider

```bash
export BIGVIZ_API_KEY=...                         # required for probe/gen/edit/regen
export BIGVIZ_BASE_URL=https://api.openai.com/v1  # any OpenAI-compatible Images API
export BIGVIZ_MODEL=gpt-image-1
bigviz doctor
```

Keep the key in your shell or a secret manager. Never commit it. No key? Bring your own
mockup (step 4b).

## 3. Ask your agent

```
/bigviz A safety points command center for a tunnel project: monthly trend, team ranking,
redemption mix, people ranking, top goods. Deep blue tech style, English.
```

The agent runs brief → design → assets → build → qa and asks you to pick at each
decision point: style, hero, final mockup, panel refine.

## 4. Or drive the CLI yourself

### 4a. With AI mockups

```bash
bigviz init my-screen --preset deep-tech-blue --locale en
cd bigviz/my-screen
bigviz probe                                # real returned sizes → .bigviz-probe.json
# edit bigviz.yaml: panels, data, hero variants, pitfalls
bigviz prompt design
bigviz gen prompts/<file>.txt --tag v1 --n 4
bigviz sheet "designs/*-v1-*.png" -o shots/v1-sheet.png
# set design.final, measure assets[] boxes
bigviz slice
bigviz matte --ids center-hub
bigviz regen --jobs 3
bigviz manifest
bigviz publish --app ../../my-app --name MyScreen
```

### 4b. Bring your own mockup

1. `bigviz init my-screen`, copy your image into `designs/`.
2. Fill `bigviz.yaml` from the image; set `design.final`.
3. Measure `assets[]`, then `slice`, `matte`, `manifest`, `publish`. Set `regen: false` on
   every asset if you have no API key.

## 5. Build and check

Copy `templates/vue3-echarts` (or embed its `src/screen/` kit), map panels to components,
then start the dev server yourself and run:

```bash
bigviz shot http://localhost:5173/ --dpr 2 -o shots/full.png
bigviz overlay shots/full.png designs/<final>.png --alpha 0.5
```

Next: [spec reference](guide-spec.md) · [matting guide](guide-matting.md)
