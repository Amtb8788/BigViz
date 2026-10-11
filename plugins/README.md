# plugins/

The agent side of BigViz. A Claude Code plugin that also works as plain
[Agent Skills](https://agentskills.io) folders in Cursor, Codex and similar tools.

```
plugins/bigviz/
├── .claude-plugin/plugin.json   # plugin manifest (name, version)
├── commands/                    # slash commands: /bigviz, /bigviz-regen, /bigviz-qa
└── skills/                      # one folder per role, each with a SKILL.md
```

Each skill is one role in a small dashboard studio:

| Skill | Role | Output |
|---|---|---|
| `bigviz` | Project lead: picks quick or studio mode, runs the phases, checks gates | the plan, decisions |
| `bigviz-brief` | Product manager: turns an idea into a spec | `bigviz.yaml` |
| `bigviz-design` | UI designer: AI mockups, comparisons, text fixes | `designs/*.png` |
| `bigviz-assets` | Visual asset artist: cut, matte, HD regen, publish | `assets/final/` + manifest |
| `bigviz-build` | Front-end developer: the Vue 3 page | `src/views/<Name>/` |
| `bigviz-qa` | QA: screenshots, overlays, motion checks | `shots/` + checklist |

Skills call the `bigviz` CLI in [`../cli`](../cli) and build on the template in
[`../templates/vue3-echarts`](../templates/vue3-echarts).
