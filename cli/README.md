# bigviz (CLI)

Command-line half of [BigViz](https://github.com/Amtb8788/BigViz): turn a `bigviz.yaml` spec into
AI mockups, matted HD assets, a typed asset manifest for your front-end, and QA screenshots.

## Install

```bash
pipx install bigviz            # or: uvx bigviz --help
pipx install "bigviz[shot]"    # + Playwright screenshots, then: playwright install chromium
```

Straight from git, no install:

```bash
uvx --from "git+https://github.com/Amtb8788/BigViz#subdirectory=cli" bigviz --help
```

## Configure

| Variable | Default | Purpose |
|---|---|---|
| `BIGVIZ_API_KEY` | (none) | required for `gen`, `edit`, `regen`, `probe` |
| `BIGVIZ_BASE_URL` | `https://api.openai.com/v1` | any OpenAI-compatible Images endpoint |
| `BIGVIZ_MODEL` | `gpt-image-1` | image model |

Keys are read from the environment only and never printed. Run `bigviz doctor` to check your setup and
`bigviz probe` to see which sizes your endpoint really returns.

## Workflow

```bash
bigviz init safety-points --preset deep-tech-blue --locale en
cd bigviz/safety-points                     # edit bigviz.yaml
bigviz prompt design                        # -> prompts/safety-points-design.txt
bigviz gen prompts/safety-points-design.txt --tag v1 --n 2
bigviz sheet "designs/*.png" -o shots/v1.png
# set design.final and assets[] in bigviz.yaml, then:
bigviz slice && bigviz matte && bigviz regen --jobs 3
bigviz publish --app ../../web
bigviz shot http://localhost:5173/#/screen --frames 8 --interval 180
bigviz overlay shots/shot.png designs/safety-points-v1-gpt-image-1.png --diff
```

Every command accepts `--spec PATH` and `--json`. See `bigviz <command> --help` and
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the spec and preset formats.

## Development

```bash
uv venv && uv pip install -e ".[dev]"
uv run pytest -q
```

MIT licensed.
