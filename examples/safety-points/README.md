# Example: Safety Points Data Center

An anonymised end-to-end BigViz run. All names, teams and numbers are fictional
("Riverside Tunnel Demo", "Team A1", "J. Doe").

- Spec: [bigviz.yaml](bigviz.yaml)
- Preset: `deep-tech-blue`, locale `en`, canvas 1920×1080
- Panels: points trend, redemption mix, team podium, conversion, people ranking, goods ranking
- Hero: three variants (`shield`, `core`, `badge`); `shield` was picked

## Reproduce

```bash
export BIGVIZ_API_KEY=...            # your own key, never commit it
bigviz init safety-points            # then replace bigviz/safety-points/bigviz.yaml with this file
cd bigviz/safety-points
bigviz doctor
bigviz probe                         # record the real returned sizes

# design
bigviz prompt design                 # repeat per preset by changing style.preset
bigviz gen prompts/<printed-file>.txt --tag v1 --n 2
bigviz prompt design --hero core
bigviz gen prompts/<printed-file>.txt --tag v2b
bigviz prompt design
bigviz gen prompts/<printed-file>.txt --tag v3 --n 5 --quality high
bigviz sheet "designs/*-v3-*.png" --cols 3 -o shots/v3-sheet.png
bigviz prompt fix                    # edit the numbered list, then:
bigviz edit prompts/<fix-file>.txt --image designs/<picked>.png --tag v3-fix1

# assets (set design.final first, then measure boxes on that file)
bigviz slice
bigviz matte --ids center-hub,podium,kpi-users,kpi-coins,node-helmet
bigviz regen --ids center-hub,podium,kpi-users,kpi-coins --jobs 3
bigviz manifest
bigviz publish --app ../../my-app --name SafetyPoints
```

Then build the page from `templates/vue3-echarts` and QA it with `bigviz shot` and
`bigviz overlay` (see the `bigviz-build` and `bigviz-qa` skills).

## Notes from the run

- The image API returned less than the requested size, so asset boxes were measured on
  the real `design.final` and HD assets came from `regen`.
- Batch v3 had a duplicated row in "Top People This Month" and a wrong unit on one row;
  one fix pass (`v3-fix1`) solved both.
- The hero shield and its pedestal overlapped, so they are one asset (`center-hub`).
- The asset boxes in `bigviz.yaml` are illustrative. Re-measure them on your own
  `design.final`: every generation is different.

The mockup and screenshots referenced in `design.final` are not committed; generate your
own with the steps above.
