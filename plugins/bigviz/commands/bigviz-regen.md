---
description: Regenerate HD dashboard assets, re-matte, re-measure and publish with backup
argument-hint: "[asset ids, comma-separated]"
---

Use the `bigviz-assets` skill to regenerate HD assets.

Asset ids: $ARGUMENTS (empty means every asset in `assets[]` whose `regen` is not `false`).

1. Run `bigviz doctor`; `BIGVIZ_API_KEY` must be set in the environment.
2. `bigviz regen --ids <ids> --jobs 3`.
3. Compare each output with its reference crop; re-run any that recomposed the subject.
4. `bigviz manifest`.
5. Inspect with `bigviz sheet "assets/final/*.png" --bg "#FF00FF"` and on the panel colour.
6. Ask before `bigviz publish --app <dir> --name <ViewName>` (it backs up first).
