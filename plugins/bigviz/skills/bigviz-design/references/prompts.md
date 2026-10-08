# Prompt templates

`bigviz prompt …` composes these from `bigviz.yaml` + the preset's `prompt` fragments and
saves them to `prompts/`. This file documents the structure so you know what to hand-tune.

## Contents
- P1 Full screen (`bigviz prompt design`)
- P2 Hero variant (`bigviz prompt design --hero <key>`)
- P3 Fix pass (`bigviz prompt fix`)
- P4 Panel concepts (`bigviz prompt panel <id>`)
- P5 Paste-back (hand-written, used with `bigviz edit`)
- P6 Regen (`bigviz prompt regen <asset>`)
- When to hand-tune

## P1 Full screen

Sections, in order:
1. Frame: "Design a flat, front-facing UI mockup of a 16:9 big-screen data dashboard.
   Output only the screen itself, no monitor bezel, room or device mockup."
2. Positioning (preset `positioning`): what the screen is for, the quality bar.
3. Visual system (preset `material` + palette hex values): background, primary/accent,
   panel material, 3D icon language, light effects.
4. Typography (preset `typography`): the most important paragraph. Plain sans-serif, sharp
   like vector text, pure white, large labels, tabular digits, no glow on small text.
5. Layout: header + three columns from `layout.columns`; panels reach the bottom edge,
   no bottom navigation bar.
6. Header: title, project (top-left), clock string (top-right).
7. KPIs: one line each, `icon | label | value unit | delta`.
8. Hero: `hero.concept` text, then the nodes with labels and values. "No text on the hero."
9. Panels: one numbered block per panel in reading order, with exact data and `notes`.
10. On-screen text: "All text must match the above verbatim." Then list `pitfalls` as
    "pay special attention to: …". "Add no paragraphs not listed above."
11. Avoid (preset `avoid`): blur, over-bloom, clutter, cartoon icons, device mockups.

## P2 Hero variant

Identical to P1 except section 8, which uses `hero.variants[<key>]`. Keep every other
byte the same; otherwise the A/B compares more than the hero.

## P3 Fix pass

```
Keep the whole dashboard exactly as it is: layout, colours, charts, icons, KPI cards and
numbers. Keep everything, fix only:
1. <panel title>: remove the duplicated row "<row>"; keep 5 rows ranked 1-5: <rows>.
2. Row "<name>": the unit is "<unit>", not "<wrong unit>".
3. Top-right date: "<date string>".
4. <panel title> legend: keep only "<a>" (<colour> line) and "<b>" (<colour> bars).
Fill the full 16:9 frame; no empty dark band at the bottom.
Add no other text.
```

One defect per line, quote the exact target string, name the panel by its on-screen title.

## P4 Panel concepts

A single-panel mockup that matches the chosen screen:
1. "A standalone panel component from the <title> dashboard, same style as the full screen."
2. Panel title and background/border description from the preset.
3. Main visual: the concept (for example a 3-step 3D podium for a rank panel), with exact
   data on it.
4. Secondary content (remaining rows).
5. Requirements: exact text, accent colours only on emphasis, no other panels or text.

Generate 2–3 concepts by changing only the main-visual paragraph.

## P5 Paste-back

Used with `bigviz edit … --image full.png,panel.png`:

```
Image 1 is the full dashboard. Image 2 is a refined version of the "<title>" panel.
Replace the "<title>" panel in image 1 (the <column> column, <position> panel) with the
design from image 2, fitted to the same panel frame. Keep everything else in image 1
exactly unchanged: other panels, hero, header, colours and all text.
```

## P6 Regen

Used by `bigviz regen` with the reference composited on black:

```
Recreate the object in the reference image as a single ultra-sharp, high-resolution
<subject>. Keep the exact same subject, shape, pose, colours and design language; only
increase detail and edge clarity.
- Centered, the object fills about <fill × 100>% of the canvas, nothing cropped.
- Background: pure solid black (#000000) everywhere: no gradient, floor, vignette,
  text, watermark or frame.
```

For multi-part objects (podiums, hero + pedestal) add: "Do not move, resize or add anything."
Allow only text that is part of the object (for example the numbers 1 2 3 on a podium).

## When to hand-tune

- Text keeps breaking: shorten long labels in the spec, add them to `pitfalls`, and make the
  P1 typography paragraph demand larger labels. Do not add more adjectives.
- Style drifts between shots: move the drifting attribute from prose into an explicit
  hex/material line in the visual system section.
- Hero dominates or disappears: adjust its size relative to the center column in section 8.
- Fix passes undo earlier fixes: include the earlier fixed strings in the "keep" sentence.
- Regen recomposes the object: lower `fill`, add "do not move, resize or add anything",
  and re-run `bigviz manifest` afterwards.
- Edit the saved prompt file, not the CLI output on screen, and keep the edited file with a
  new name so the run stays reproducible.
