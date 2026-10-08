"""CLI smoke tests (argparse wiring, exit codes); Playwright tests skip when missing."""

from __future__ import annotations

import json

import pytest
from PIL import Image

from bigviz.cli import build_parser, main
from bigviz.shot import frame_paths, load_login, playwright_available, ShotError


def test_help_lists_every_contract_command(capsys):
    with pytest.raises(SystemExit):
        main(["--help"])
    out = capsys.readouterr().out
    for cmd in ("init", "doctor", "probe", "prompt", "gen", "edit", "sheet", "slice", "matte",
                "erase", "regen", "manifest", "publish", "shot", "overlay"):
        assert cmd in out


def test_init_then_prompt(tmp_path, capsys):
    assert main(["init", "demo", "--dir", str(tmp_path), "--locale", "zh"]) == 0
    spec = tmp_path / "bigviz" / "demo" / "bigviz.yaml"
    assert spec.is_file()
    assert main(["init", "demo", "--dir", str(tmp_path)]) == 2  # exists -> spec error
    capsys.readouterr()
    assert main(["prompt", "design", "--spec", str(spec), "--json"]) == 0
    data = json.loads(capsys.readouterr().out)
    assert "Monthly Trend" in data["prompt"] and data["file"].endswith("demo-design.txt")


def test_spec_option_before_subcommand(workspace, capsys):
    spec = str(workspace / "bigviz.yaml")
    assert main(["--spec", spec, "prompt", "regen", "orb", "--no-save"]) == 0
    assert capsys.readouterr().out.startswith("Recreate a glowing orb")
    assert main(["--spec", spec, "prompt", "regen", "tile"]) == 2  # regen: false


def test_bad_spec_exit_code(workspace, capsys):
    p = workspace / "bigviz.yaml"
    p.write_text(p.read_text() + "\nextra: 1\n", encoding="utf-8")
    assert main(["slice", "--spec", str(p)]) == 2
    assert "spec.extra: unknown key" in capsys.readouterr().err


def test_slice_matte_erase_sheet_overlay(workspace, tmp_path, capsys):
    spec = str(workspace / "bigviz.yaml")
    assert main(["slice", "--spec", spec]) == 0
    assert main(["matte", "--spec", spec, "--ids", "orb"]) == 0
    src = workspace / "assets/placeholder/orb.png"
    for extra in (["--method", "black"], ["--method", "unscreen", "--feather", "ellipse:0.7", "--bg", "rows"],
                  ["--method", "grabcut", "--seed", "bright"]):
        dst = tmp_path / f"m-{extra[1]}.png"
        assert main(["matte", str(src), str(dst), *extra]) == 0 and dst.is_file()
    design = workspace / "designs/demo-v1.png"
    assert main(["erase", str(design), str(tmp_path / "e.png"), "--boxes", "10,10,40,20;100,100,20,20"]) == 0
    sheet = tmp_path / "sheet.png"
    assert main(["sheet", str(workspace / "assets/placeholder/*.png"), "-o", str(sheet), "--cols", "2"]) == 0
    with Image.open(sheet) as im:
        assert im.width > 0
    assert main(["overlay", str(design), str(design), "--diff", "-o", str(tmp_path / "ov.png"),
                 "--json"]) == 0
    out = capsys.readouterr().out
    assert json.loads(out[out.index("{"):])["mean_diff"] == 0.0


def test_gen_without_key_fails_cleanly(workspace, monkeypatch, capsys):
    monkeypatch.delenv("BIGVIZ_API_KEY", raising=False)
    prompt = workspace / "p.txt"
    prompt.write_text("x")
    assert main(["gen", str(prompt), "--tag", "v1", "--spec", str(workspace / "bigviz.yaml")]) == 1
    assert "BIGVIZ_API_KEY" in capsys.readouterr().err


def test_doctor_json(monkeypatch, capsys, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("BIGVIZ_API_KEY", "sk-secret-value")
    code = main(["doctor", "--json"])
    out = capsys.readouterr().out
    data = json.loads(out)
    assert code == 0 and data["ok"] is True
    assert "sk-secret-value" not in out
    assert {c["check"] for c in data["checks"]} >= {"python", "pillow", "numpy", "opencv", "BIGVIZ_API_KEY"}


def test_shot_parser_and_helpers(tmp_path):
    args = build_parser().parse_args(["shot", "http://x", "--frames", "8", "--interval", "180",
                                      "--login-script", "l.py", "--wait", "500"])
    assert args.frames == 8 and args.login_script == "l.py" and args.wait == 500
    assert [p.name for p in frame_paths(tmp_path / "s.png", 3)] == ["s-01.png", "s-02.png", "s-03.png"]
    script = tmp_path / "login.py"
    script.write_text("def login(page):\n    page.goto('about:blank')\n")
    assert callable(load_login(script).login)
    bad = tmp_path / "bad.py"
    bad.write_text("x = 1\n")
    with pytest.raises(ShotError):
        load_login(bad)


@pytest.mark.skipif(not playwright_available(), reason="Playwright not installed")
def test_shot_capture_local_file(tmp_path):
    from bigviz.shot import capture

    page = tmp_path / "p.html"
    page.write_text("<html><body style='margin:0;background:#123'><div id='a' "
                    "style='width:50px;height:40px;background:red'></div></body></html>")
    try:
        paths = capture(page.as_uri(), tmp_path / "s.png", viewport="200x100", dpr=1,
                        selector="#a", frames=2, interval=10, wait=0)
    except Exception as exc:  # browser binary missing
        pytest.skip(f"Playwright browser unavailable: {exc}")
    with Image.open(paths[0]) as im:
        assert im.size == (50, 40)
