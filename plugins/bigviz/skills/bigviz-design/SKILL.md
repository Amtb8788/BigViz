---
name: bigviz-design
description: "Generate and iterate AI mockups for a big-screen dashboard from bigviz.yaml: preset style shoot-out with contact sheets, hero A/B variants, batch final render, edit-based text fix passes and per-panel refine with paste-back. Use when the user wants a dashboard mockup, big screen design image, command center or cockpit visual concept, wants to compare styles, fix garbled text on a mockup, or says 大屏设计稿, 数据大屏效果图, 可视化大屏出图, 驾驶舱设计, 指挥中心效果图, 改设计稿, 修文字."
---

# BigViz design

Produce a picked, text-accurate mockup and set `design.final` in `bigviz.yaml`.
Run every command from the workspace (`bigviz/<slug>/`). Fallback when `bigviz` is missing:
`uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz <cmd>`.
Run `bigviz doctor` first; image commands need `BIGVIZ_API_KEY` in env (never hard-code it).

Prompt structure and hand-tuning guidance: [references/prompts.md](references/prompts.md).

## Naming

- Images: `designs/<slug>-<version>-<model>[-n].png`, flat, one JSON sidecar each (written by
  the CLI). Versions: `v1`, `v2`, `v3a`/`v3b` for A/B, `v4-fix1` for fix passes.
- Prompts: keep every prompt file in `prompts/`. Never delete them; they make runs reproducible.
- Log each iteration in `design.versions` with a one-line note.

## Steps

### 1. Style shoot-out
1. For each candidate preset (default: `deep-tech-blue`, `editorial-dark`, `aurora-glass`),
   set `style.preset`, run `bigviz prompt design`, then
   `bigviz gen prompts/<file>.txt --tag v1-<preset> --n 2` (2–3 shots per preset).
2. Build a sheet: `bigviz sheet "designs/*-v1-*.png" --cols 3 -o shots/style-sheet.png`.
3. Ask the user to pick a style. Record it in `style.preset`.

### 2. Hero A/B
1. For each key in `hero.variants`: `bigviz prompt design --hero <key>`, then
   `bigviz gen … --tag v2<letter>`. Change only the hero section; everything else stays
   identical so the comparison is fair.
2. Sheet the results and ask the user to pick a hero. Set `hero.concept`.

### 3. Batch the final
1. `bigviz prompt design`, then `bigviz gen … --tag v3 --n 5` (n = 4–7, `--quality high`).
2. Score each image against the spec: walk the `pitfalls` list, then every panel title,
   legend, KPI and rank row. Count wrong strings.
3. Show the sheet plus the error counts; ask the user to pick. The fewest text errors wins
   ties on look.

### 4. Fix pass (edit)
1. List concrete defects: duplicated rows, wrong units, wrong dates/weekdays, garbled or
   extra legends, invented text, a dark empty band at the bottom.
2. `bigviz prompt fix` composes the P3 prompt; edit its numbered list to the defects found.
   It must start with "keep everything, fix only: …" and end with "add no other text".
3. `bigviz edit prompts/<fix>.txt --image designs/<picked>.png --tag v3-fix1`.
4. Re-check. Repeat at most 2–3 times; if errors grow, return to the best previous image.

### 5. Panel refine (optional, ask first)
1. Ask which panels look weak. For each: `bigviz prompt panel <id>`, generate 2–3 concepts,
   sheet them, let the user pick.
2. Paste back: `bigviz edit <P5 prompt> --image designs/<full>.png,designs/<panel>.png
   --tag v4-<id>`. The prompt names the exact region to replace and says keep everything else.
3. Re-check text in the replaced region.

### 6. Finish
1. Set `design.final` to the chosen file (path relative to the workspace).
2. Confirm the image size; asset boxes in the next phase are in pixels of this file.
3. Hand off to `bigviz-assets`.

## Rules

- Mockups judge layout, hierarchy and 3D style. The page renders real text in code, so do
  not chase pixel-perfect text forever: stop when layout and strings are right enough.
- Prefer edit fixes over full regenerations once the composition is right.
- Read the pitfalls reference in the `bigviz` skill when text keeps breaking or sizes are off.
