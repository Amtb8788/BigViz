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

Run `bigviz doctor` first. Ask the user at every decision point (style, hero, final mockup,
panel refine). Never start dev servers yourself.
