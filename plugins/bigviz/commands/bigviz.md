---
description: Build a big-screen data dashboard end to end (brief, design, assets, build, qa)
argument-hint: "[idea or phase: brief|design|assets|build|qa]"
---

Use the `bigviz` skill to run the BigViz pipeline.

Input: $ARGUMENTS

- If the input names a phase (`brief`, `design`, `assets`, `build`, `qa`), start at that phase
  and use the matching `bigviz-<phase>` skill.
- If the input is an idea, start at brief.
- If the input is empty, inspect the project (`bigviz/*/bigviz.yaml`, `design.final`,
  `assets/final/`, published `assets.manifest.ts`) and propose the entry phase.

- If the input mentions 比稿, A/B, 精修 or studio, use studio mode; otherwise use quick mode
  (2–3 user turns, see the `bigviz` skill).

Run `bigviz doctor` first. In studio mode, ask the user at every decision point (style, hero,
final mockup, panel refine); in quick mode, decide and show your pick. Never start dev
servers yourself.
