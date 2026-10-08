"""Matte regression on synthetic images (no network)."""

from __future__ import annotations

import numpy as np
from PIL import Image

from bigviz import matte as M
from conftest import glow_disc


def _to_img(rgb01: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(rgb01, 0, 1) * 255).round().astype(np.uint8))


def _composite(rgba: Image.Image, bg) -> np.ndarray:
    a = np.asarray(rgba, np.float32) / 255
    return a[..., :3] * a[..., 3:4] + np.asarray(bg, np.float32) / 255 * (1 - a[..., 3:4])


def test_black_to_alpha_round_trip_exact():
    disc = glow_disc(96)
    on_black = disc[..., :3] * disc[..., 3:4]
    out = M.black_to_alpha(_to_img(on_black), floor=0.0, gain=1.0)
    a = np.asarray(out, np.float32)[..., 3] / 255
    max_c = on_black.max(axis=2)
    assert np.abs(a - max_c).max() < 2 / 255  # alpha = brightness of the brightest channel
    # un-premultiplied colour keeps the glow hue where alpha is meaningful
    fg = np.asarray(out, np.float32)[..., :3] / 255
    mask = a > 0.2
    assert np.abs(fg[mask] - disc[..., :3][mask]).max() < 0.03
    # composite back on black reproduces the input
    assert np.abs(_composite(out, (0, 0, 0)) - on_black).max() < 3 / 255


def test_black_to_alpha_defaults_cut_floor_and_keep_core():
    disc = glow_disc(96)
    on_black = disc[..., :3] * disc[..., 3:4]
    on_black += 0.03  # faint noise floor everywhere
    out = np.asarray(M.black_to_alpha(_to_img(on_black)), np.float32)
    assert out[0, 0, 3] == 0  # floor (0.06) removes the noise
    assert out[48, 48, 3] == 255  # solid core stays opaque


def test_unscreen_recovers_alpha_on_known_background():
    bg = np.array([8, 30, 86], np.float32) / 255
    h = w = 80
    yy, xx = np.mgrid[0:h, 0:w]
    alpha = np.clip(1 - np.hypot(xx - 39.5, yy - 39.5) / 30, 0, 1)
    fg = np.ones(3, np.float32)  # white glow: alpha is exactly recoverable
    comp = fg * alpha[..., None] + bg * (1 - alpha[..., None])
    out = M.unscreen(_to_img(comp), bg=tuple(bg * 255), gain=1.0, bias=0.0)
    got = np.asarray(out, np.float32)[..., 3] / 255
    assert np.abs(got - alpha).max() < 0.02
    assert np.abs(_composite(out, bg * 255) - comp).max() < 0.02


def test_unscreen_auto_and_rows_background():
    h, w = 60, 120
    ramp = np.linspace(20, 90, h)[:, None, None] * np.ones((1, w, 1)) * np.array([0.2, 0.5, 1.0])
    img = ramp.copy()
    img[20:40, 50:70] = 255  # opaque white block on a vertical gradient
    pil = Image.fromarray(img.round().astype(np.uint8))
    rows = np.asarray(M.unscreen(pil, bg="rows", gain=1.0, bias=0.0), np.float32)[..., 3] / 255
    assert rows[30, 60] > 0.98
    assert rows[5:55, 2:40].max() < 0.05  # gradient background is fully removed
    flat = np.asarray(M.unscreen(pil, feather_rect=0.2), np.float32)[..., 3]
    assert flat[0, 0] == 0  # feathered edges


def test_trim_ratios():
    im = Image.new("RGBA", (200, 100), (0, 0, 0, 0))
    im.paste((255, 255, 255, 255), (20, 10, 150, 90))  # l=20 t=10 r=150 b=90
    cropped, bbox, ratios = M.trim(im)
    assert bbox == (20, 10, 150, 90)
    assert cropped.size == (130, 80)
    assert ratios == {"l": 0.1, "t": 0.1, "r": 0.25, "b": 0.1}
    empty = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    assert M.trim(empty)[1] is None


def test_fit_downscale_only():
    im = Image.new("RGBA", (400, 200))
    assert M.fit(im, 100).size == (100, 50)
    assert M.fit(im, 1000).size == (400, 200)
    assert M.fit(im, 800, upscale=True).size == (800, 400)


def test_erase_text_removes_glyphs():
    base = np.linspace(40, 120, 100)[None, :, None] * np.ones((60, 1, 3))
    img = base.copy()
    img[25:35, 30:70] = 255  # fake text bar
    out = np.asarray(M.erase_text(Image.fromarray(img.astype(np.uint8)), [(25, 20, 50, 20)]), np.float32)
    assert out[25:35, 30:70].max() < 160
    assert np.abs(out[25:35, 30:70] - base[25:35, 30:70]).mean() < 25


def test_grabcut_seed_and_rect():
    img = np.full((80, 80, 3), (10, 30, 80), np.uint8)
    img[20:60, 20:60] = (230, 180, 60)  # warm square
    out = np.asarray(M.grabcut(Image.fromarray(img), seed_fn="warm", min_area=50))
    assert out[40, 40, 3] > 200 and out[5, 5, 3] == 0
    out2 = np.asarray(M.grabcut(Image.fromarray(img), rect=(15, 15, 50, 50), min_area=50))
    assert out2[40, 40, 3] > 200 and out2[2, 2, 3] == 0
