# Pitfalls

Known failure modes from production runs. Symptom → cause → fix.

## Contents
1. Proxies ignore `size`
2. Garbled CJK text
3. Baked-in backgrounds
4. Overlapping crops
5. Inpaint smears
6. Gradient haze
7. Regen changes aspect
8. Asymmetric transparent margins
9. Transform blur
10. Host layout overrides
11. Blend isolation
12. Regen overwriting live assets

## 1. Proxies ignore `size`
- Symptom: you asked for 2048x1152, got 1536x1024 or 1024x1024.
- Cause: OpenAI-compatible proxies and some models silently clamp or ignore `size`.
- Fix: run `bigviz probe` before planning. Read `.bigviz-probe.json` and plan box coordinates,
  crop margins and regen targets around the real size. Never assume the requested size.

## 2. Garbled CJK text
- Symptom: wrong or invented characters, duplicated rows, `分` vs `次` unit swaps,
  merged legends, dates mangled.
- Cause: image models render dense small CJK text poorly, worst on names and legends.
- Fix: list risky strings in `pitfalls`; ask for large, pure-white, high-contrast labels;
  batch n=4–7 and pick the most accurate; then a fix pass with
  "keep everything, fix only: …". The page renders real text in code anyway, so the mockup
  only needs to be accurate enough to judge layout.

## 3. Baked-in backgrounds
- Symptom: a cropped icon carries a square of panel colour or gradient.
- Cause: mockups have no alpha; every crop includes its background.
- Fix: choose a matte method per asset (`unscreen` for tinted panels, `black` after a regen
  on pure black, `grabcut` for solid metal). Check on magenta with `bigviz sheet "assets/final/*.png" --bg "#FF00FF"`.

## 4. Overlapping crops
- Symptom: the hero crop includes part of the pedestal, the pedestal crop includes the hero.
- Cause: boxes overlap on the mockup; separate assets double-draw the overlap.
- Fix: merge overlapping parts (hero + pedestal) into one asset with one box.

## 5. Inpaint smears
- Symptom: after `erase`, a blurry smudge where text was.
- Cause: inpaint over large or textured areas.
- Fix: keep erase boxes tight around glyphs; `erase` uses row interpolation for gradients.
  For large areas prefer `regen` with "no text" in the prompt.

## 6. Gradient haze
- Symptom: a faint rectangular halo around a matted icon on vertical gradients.
- Cause: single-colour background estimation on a gradient panel.
- Fix: `unscreen` estimates background row by row; make sure the box includes some clean
  background above and below the object so each row has a sample.

## 7. Regen changes aspect
- Symptom: the HD asset looks shifted or squashed in the page.
- Cause: the model recomposes the subject; trim margins and aspect differ from the crop.
- Fix: run `bigviz manifest` after every regen and take width/height/aspect/trim from
  `assets.manifest.ts`. Never hard-code aspect ratios or pixel offsets.

## 8. Asymmetric transparent margins
- Symptom: the object sits off-centre although the `<img>` is centred.
- Cause: transparent padding differs left/right or top/bottom.
- Fix: use the trim ratios from the manifest to offset, or trim at publish time.

## 9. Transform blur
- Symptom: text and chart lines go soft on the scaled screen.
- Cause: `transform: scale()` rasterises then scales.
- Fix: scale the screen with CSS `zoom`; set ECharts `devicePixelRatio = zoom × DPR`
  (rounded to 0.5, max 4).

## 10. Host layout overrides
- Symptom: the screen is cut off or has 0 height inside an admin app.
- Cause: wrapper rules like `height: calc(100vh - 84px)`, `overflow: hidden`, padding on
  `.app-main`.
- Fix: inspect the wrapper chain; give the screen route a full-bleed layout or override the
  wrapper for that route only.

## 11. Blend isolation
- Symptom: a glow layer with `mix-blend-mode: screen` turns into a dark box mid-animation.
- Cause: animating `opacity` on the whole layer (or adding `transform`/`filter`) creates a
  new stacking context and isolates the blend.
- Fix: never animate opacity on a front effect layer as a whole; animate its children, or
  use an independent sibling.

## 12. Regen overwriting live assets
- Symptom: a bad regen replaced the good asset in the app.
- Cause: writing straight into `src/assets`.
- Fix: regen writes to `assets/regen/<id>/` and `assets/final/`; only `bigviz publish` copies
  into the app, and it backs up to `backup/<timestamp>/` first. Roll back from there.
