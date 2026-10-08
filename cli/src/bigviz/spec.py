"""Load and validate `bigviz.yaml` (spec version 1) and preset files.

Validation is strict: every unknown key is an error and every error message
starts with the dotted key path (e.g. `spec.assets[2].matte`).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path
from typing import Any, Callable

import yaml

SPEC_FILE = "bigviz.yaml"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
PALETTE_KEYS = ("bg0", "bg1", "primary", "accent", "warn", "ok", "violet", "text")
FONT_KEYS = ("ui", "number")
PANEL_TYPES = ("line", "bar", "pie", "ring", "rank", "podium", "kpi", "table", "custom")
MATTE_METHODS = ("none", "unscreen", "black", "grabcut")
WORKSPACE_DIRS = (
    "prompts", "designs", "assets/placeholder", "assets/alpha",
    "assets/regen", "assets/final", "shots", "backup",
)


class SpecError(ValueError):
    """Raised when a spec or preset is invalid. `errors` holds every problem found."""

    def __init__(self, errors: list[str] | str):
        self.errors = [errors] if isinstance(errors, str) else list(errors)
        super().__init__("\n".join(self.errors))


# --------------------------------------------------------------------------- schema DSL


@dataclass
class F:
    """One field: accepted types, default, nested schema, element schema, extra check."""

    types: tuple
    default: Any = None
    required: bool = False
    fields: dict[str, "F"] | None = None  # nested mapping schema
    item: "F | None" = None  # list element schema
    values: "F | None" = None  # free-key mapping: schema for every value
    check: Callable[[Any], str | None] | None = None


def _tname(types: tuple) -> str:
    names = {dict: "mapping", list: "list", str: "string", int: "integer",
             float: "number", bool: "boolean", type(None): "null"}
    return " or ".join(names.get(t, t.__name__) for t in types)


def _validate(value: Any, f: F, path: str, errors: list[str]) -> Any:
    # bool is an int subclass: never accept it where only numbers are allowed
    if isinstance(value, bool) and bool not in f.types:
        errors.append(f"{path}: expected {_tname(f.types)}, got boolean")
        return value
    if isinstance(value, int) and not isinstance(value, bool) and float in f.types:
        value = float(value) if int not in f.types else value
    if not isinstance(value, f.types):
        errors.append(f"{path}: expected {_tname(f.types)}, got {type(value).__name__}")
        return value
    if isinstance(value, dict) and f.fields is not None:
        value = _validate_map(value, f.fields, path, errors)
    elif isinstance(value, dict) and f.values is not None:
        value = {k: _validate(v, f.values, f"{path}.{k}", errors) for k, v in value.items()}
    elif isinstance(value, list) and f.item is not None:
        value = [_validate(v, f.item, f"{path}[{i}]", errors) for i, v in enumerate(value)]
    if f.check is not None:
        msg = f.check(value)
        if msg:
            errors.append(f"{path}: {msg}")
    return value


def _validate_map(data: dict, schema: dict[str, F], path: str, errors: list[str]) -> dict:
    out: dict[str, Any] = {}
    for key in data:
        if key not in schema:
            errors.append(f"{path}.{key}: unknown key (allowed: {', '.join(schema)})")
    for key, f in schema.items():
        if key in data:
            out[key] = _validate(data[key], f, f"{path}.{key}", errors)
        elif f.required:
            errors.append(f"{path}.{key}: required key missing")
        elif f.default is not None:
            dv = f.default
            out[key] = dv() if callable(dv) else dv
        elif f.fields is not None:
            out[key] = _validate_map({}, f.fields, f"{path}.{key}", errors)
        else:
            out[key] = None
    return out


# --------------------------------------------------------------------------- checks


def _one_of(*allowed: Any) -> Callable[[Any], str | None]:
    return lambda v: None if v in allowed else f"must be one of {', '.join(map(str, allowed))}"


def _slug(v: str) -> str | None:
    return None if SLUG_RE.match(v) else "must be kebab-case (a-z, 0-9, '-')"


def _hex(v: str) -> str | None:
    return None if HEX_RE.match(v) else "must be a #RRGGBB colour"


def _box(v: list) -> str | None:
    if len(v) != 4 or not all(isinstance(n, int) and not isinstance(n, bool) for n in v):
        return "must be [x, y, w, h] integers"
    if v[0] < 0 or v[1] < 0 or v[2] <= 0 or v[3] <= 0:
        return "x, y must be >= 0 and w, h > 0"
    return None


def _positive(v: Any) -> str | None:
    return None if v is None or v > 0 else "must be > 0"


def _fill(v: Any) -> str | None:
    return None if 0.1 <= v <= 1.0 else "must be between 0.1 and 1.0"


def _columns(v: list) -> str | None:
    if not v or not all(isinstance(n, (int, float)) and n > 0 for n in v):
        return "must be a list of positive percentages"
    return None if abs(sum(v) - 100) <= 0.5 else f"must sum to 100 (got {sum(v)})"


def _regen(v: Any) -> str | None:
    return "use false or a mapping {subject, fill}" if v is True else None


STR, NUM = (str,), (int, float)
_ANY_SCALAR = (str, int, float, bool, type(None))

SPEC_SCHEMA: dict[str, F] = {
    "version": F((int,), required=True, check=_one_of(1)),
    "meta": F((dict,), required=True, fields={
        "slug": F(STR, required=True, check=_slug),
        "title": F(STR, required=True),
        "project": F(STR, default=""),
        "locale": F(STR, default="en", check=_one_of("en", "zh")),
        "canvas": F((dict,), fields={
            "width": F((int,), default=1920, check=_positive),
            "height": F((int,), default=1080, check=_positive),
        }),
    }),
    "style": F((dict,), fields={
        "preset": F(STR, default="deep-tech-blue"),
        "palette": F((dict,), default=dict, values=F(STR, check=_hex),
                     check=lambda v: next((f"unknown palette key '{k}' (allowed: {', '.join(PALETTE_KEYS)})"
                                           for k in v if k not in PALETTE_KEYS), None)),
        "fonts": F((dict,), default=dict, values=F(STR),
                   check=lambda v: next((f"unknown font key '{k}' (allowed: {', '.join(FONT_KEYS)})"
                                         for k in v if k not in FONT_KEYS), None)),
    }),
    "layout": F((dict,), fields={
        "columns": F((list,), default=lambda: [24, 52, 24], item=F(NUM), check=_columns),
        "header": F((dict,), fields={
            "clock": F((bool,), default=True),
            "weather": F((bool,), default=False),
        }),
        "bottom_nav": F((bool,), default=False),
    }),
    "panels": F((list,), default=list, item=F((dict,), fields={
        "id": F(STR, required=True, check=_slug),
        "column": F(STR, required=True, check=_one_of("left", "center", "right")),
        "title": F(STR, required=True),
        "type": F(STR, default="custom", check=_one_of(*PANEL_TYPES)),
        "data": F((dict, list), default=dict),
        "notes": F(STR, default=""),
    })),
    "hero": F((dict,), fields={
        "concept": F(STR, default=""),
        "variants": F((dict,), default=dict, values=F(STR)),
        "nodes": F((list,), default=list, item=F((dict,), fields={
            "label": F(STR, required=True),
            "icon": F(STR, default=""),
            "value": F(_ANY_SCALAR),
            "unit": F(STR, default=""),
        })),
    }),
    "kpis": F((list,), default=list, item=F((dict,), fields={
        "label": F(STR, required=True),
        "value": F((int, float, str), required=True),
        "unit": F(STR, default=""),
        "icon": F(STR, default=""),
        "delta": F(STR, default=""),
    })),
    "pitfalls": F((list,), default=list, item=F(STR)),
    "design": F((dict,), fields={
        "versions": F((list,), default=list, item=F((dict,), fields={
            "tag": F(STR, required=True),
            "note": F(STR, default=""),
        })),
        "final": F((str, type(None))),
    }),
    "assets": F((list,), default=list, item=F((dict,), fields={
        "id": F(STR, required=True, check=_slug),
        "box": F((list,), required=True, check=_box),
        "matte": F(STR, default="unscreen", check=_one_of(*MATTE_METHODS)),
        "erase": F((list,), default=list, item=F((list,), check=_box)),
        "regen": F((bool, dict), default=False, check=_regen, fields={
            "subject": F(STR, required=True),
            "fill": F((float,), default=0.85, check=_fill),
        }),
        "target": F((int,), default=1000, check=_positive),
        "use": F(STR, default=""),
    })),
}

_LOCALISED = F((str, dict), fields={"en": F(STR, required=True), "zh": F(STR)})
PRESET_SCHEMA: dict[str, F] = {
    "name": F(STR, required=True, check=_slug),
    "label": F(STR, required=True),
    "palette": F((dict,), required=True, fields={k: F(STR, required=True, check=_hex) for k in PALETTE_KEYS}),
    "fonts": F((dict,), required=True, fields={k: F(STR, required=True) for k in FONT_KEYS}),
    "prompt": F((dict,), required=True, fields={
        k: F(_LOCALISED.types, required=True, fields=_LOCALISED.fields)
        for k in ("positioning", "material", "panel", "typography", "avoid")
    }),
}


# --------------------------------------------------------------------------- spec object


@dataclass
class Spec:
    """A validated spec plus the workspace it lives in."""

    data: dict
    workspace: Path
    path: Path | None = None
    _preset: dict | None = field(default=None, repr=False)

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    @property
    def slug(self) -> str:
        return self.data["meta"]["slug"]

    @property
    def locale(self) -> str:
        return self.data["meta"]["locale"]

    def resolve(self, rel: str | Path) -> Path:
        """Resolve a path relative to the workspace (absolute paths pass through)."""
        p = Path(rel)
        return p if p.is_absolute() else (self.workspace / p)

    def dir(self, name: str) -> Path:
        """Workspace sub-directory (`designs`, `assets/final`, ...), created on demand."""
        d = self.workspace / name
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def final_design(self) -> Path | None:
        rel = self.data["design"]["final"]
        return self.resolve(rel) if rel else None

    def asset(self, asset_id: str) -> dict:
        for a in self.data["assets"]:
            if a["id"] == asset_id:
                return a
        raise SpecError(f"spec.assets: no asset with id '{asset_id}'")

    def select_assets(self, ids: list[str] | None) -> list[dict]:
        return [self.asset(i) for i in ids] if ids else list(self.data["assets"])

    @property
    def preset(self) -> dict:
        if self._preset is None:
            self._preset = load_preset(self.data["style"]["preset"], base=self.workspace)
        return self._preset

    @property
    def palette(self) -> dict[str, str]:
        return {**self.preset["palette"], **self.data["style"]["palette"]}

    @property
    def fonts(self) -> dict[str, str]:
        return {**self.preset["fonts"], **self.data["style"]["fonts"]}


def _cross_checks(data: dict, workspace: Path, errors: list[str], check_files: bool) -> None:
    for coll in ("panels", "assets"):
        seen: set[str] = set()
        items = data.get(coll)
        for i, item in enumerate(items if isinstance(items, list) else []):
            iid = item.get("id") if isinstance(item, dict) else None
            if iid in seen:
                errors.append(f"spec.{coll}[{i}].id: duplicate id '{iid}'")
            seen.add(iid)
    design = data.get("design")
    final = design.get("final") if isinstance(design, dict) else None
    if errors or not (check_files and isinstance(final, str) and data.get("assets")):
        return
    fpath = Path(final) if Path(final).is_absolute() else workspace / final
    if not fpath.is_file():
        errors.append(f"spec.design.final: file not found: {fpath}")
        return
    from PIL import Image

    with Image.open(fpath) as im:
        W, H = im.size
    for i, a in enumerate(data["assets"]):
        boxes = [("box", a.get("box"))] + [(f"erase[{j}]", b) for j, b in enumerate(a.get("erase") or [])]
        for name, b in boxes:
            if isinstance(b, list) and _box(b) is None and (b[0] + b[2] > W or b[1] + b[3] > H):
                errors.append(f"spec.assets[{i}].{name}: {b} lies outside design.final ({W}x{H})")


def validate(data: Any, workspace: Path | str = ".", check_files: bool = True) -> dict:
    """Validate raw spec data; returns the normalised dict (defaults filled) or raises SpecError."""
    errors: list[str] = []
    if not isinstance(data, dict):
        raise SpecError("spec: top level must be a mapping")
    out = _validate_map(data, SPEC_SCHEMA, "spec", errors)
    _cross_checks(out, Path(workspace), errors, check_files)  # file checks only run on a clean spec
    if errors:
        raise SpecError(errors)
    return out


def load_spec(path: Path | str, check_files: bool = True) -> Spec:
    """Load `bigviz.yaml`; the workspace is the directory that contains it."""
    path = Path(path).resolve()
    if not path.is_file():
        raise SpecError(f"spec: file not found: {path}")
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise SpecError(f"spec: YAML parse error in {path}: {exc}") from exc
    return Spec(validate(raw, path.parent, check_files), path.parent, path)


def find_spec(explicit: str | Path | None = None, cwd: Path | None = None) -> Path:
    """`--spec` if given, else ./bigviz.yaml, else the only bigviz/*/bigviz.yaml."""
    if explicit:
        return Path(explicit)
    cwd = Path(cwd or Path.cwd())
    if (cwd / SPEC_FILE).is_file():
        return cwd / SPEC_FILE
    found = sorted(cwd.glob(f"bigviz/*/{SPEC_FILE}"))
    if len(found) == 1:
        return found[0]
    if not found:
        raise SpecError("spec: no bigviz.yaml found (use --spec or run `bigviz init <slug>`)")
    raise SpecError("spec: several workspaces found, pick one with --spec: "
                    + ", ".join(str(p) for p in found))


# --------------------------------------------------------------------------- presets


def preset_names() -> list[str]:
    root = resources.files("bigviz") / "presets"
    return sorted(p.name[:-5] for p in root.iterdir() if p.name.endswith(".yaml"))


def load_preset(name_or_path: str, base: Path | None = None) -> dict:
    """Load a bundled preset by name, or a custom preset file (path relative to `base`)."""
    if name_or_path.endswith((".yaml", ".yml")):
        p = Path(name_or_path)
        p = p if p.is_absolute() or base is None else base / p
        text = p.read_text(encoding="utf-8")
    else:
        res = resources.files("bigviz") / "presets" / f"{name_or_path}.yaml"
        if not res.is_file():
            raise SpecError(f"spec.style.preset: unknown preset '{name_or_path}' "
                            f"(available: {', '.join(preset_names())})")
        text = res.read_text(encoding="utf-8")
    errors: list[str] = []
    data = _validate_map(yaml.safe_load(text) or {}, PRESET_SCHEMA, f"preset[{name_or_path}]", errors)
    if errors:
        raise SpecError(errors)
    return data


def localised(value: str | dict, locale: str) -> str:
    """Pick the locale variant of a preset fragment (falls back to English)."""
    if isinstance(value, str):
        return value.strip()
    return (value.get(locale) or value["en"]).strip()


# --------------------------------------------------------------------------- init


def init_workspace(root: Path, slug: str, preset: str = "deep-tech-blue",
                   locale: str = "en", force: bool = False) -> Path:
    """Create `bigviz/<slug>/` with every workspace dir and a starter spec."""
    if _slug(slug):
        raise SpecError(f"init: slug '{slug}' must be kebab-case")
    load_preset(preset)  # fail early on a bad preset name
    ws = Path(root) / "bigviz" / slug
    spec_path = ws / SPEC_FILE
    if spec_path.exists() and not force:
        raise SpecError(f"init: {spec_path} already exists (use --force to overwrite)")
    for d in WORKSPACE_DIRS:
        (ws / d).mkdir(parents=True, exist_ok=True)
    tpl = (resources.files("bigviz") / "starter.yaml").read_text(encoding="utf-8")
    title = "Data Center" if locale == "en" else "数据中心"
    text = (tpl.replace("{{slug}}", slug).replace("{{preset}}", preset)
               .replace("{{locale}}", locale).replace("{{title}}", title))
    spec_path.write_text(text, encoding="utf-8")
    validate(yaml.safe_load(text), ws, check_files=False)  # the starter must always be valid
    return spec_path
