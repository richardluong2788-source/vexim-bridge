#!/usr/bin/env python3
"""
Derive the square Vexim brand mark from the master logo in public/.

`public/vexim-logo.png` is the full lockup (V mark + "VEXIM" wordmark) with a
real alpha channel. UI spots that used to render a generic lucide glyph in a
coloured square (auth headers, the admin/client sidebars, the intake links) need
the square half of the brand on its own.

This script crops the mark out of the lockup and re-centres it on a square
transparent canvas. Re-sampling happens on *premultiplied* alpha, which is the
only way to upscale RGBA art without the dark halo you get from resizing the
colour channels independently.

Run from the repo root:  python3 scripts/build-brand-mark.py
"""

from __future__ import annotations

import os
import sys

from PIL import Image
import numpy as np

# Mark bounds measured from the alpha channel of public/vexim-logo.png.
# Kept as explicit constants so a re-run on a re-exported logo is a one-line
# change rather than a re-derivation.
MARK_BOX = (87, 9, 327, 164)  # (left, top, right, bottom)

# Final square canvas. 512 keeps the mark crisp for every size the app renders
# (the largest badge today is h-9 = 36px, i.e. 108 physical px on a 3x screen)
# while staying a small file next to next/image's optimiser output.
CANVAS = 512
# Fraction of the canvas the mark's longest edge occupies. The remainder is
# optical breathing room so the mark does not touch the rounded badge edges.
FILL = 0.78

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "vexim-logo.png")
OUT = os.path.join(ROOT, "public", "vexim-mark.png")


def resize_premultiplied(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """LANCZOS-resize RGBA art without fringing.

    Straight (non-premultiplied) alpha stores colour independently of coverage,
    so a transparent pixel can still hold dark RGB. Interpolating those colours
    directly bleeds that dark fringe into the semi-transparent edge. Scaling the
    premultiplied channels and undoing it afterwards keeps edges clean.
    """
    src = np.asarray(img, dtype=np.float64) / 255.0
    alpha = src[..., 3:4]

    # Premultiply: work in linear coverage space so a transparent pixel
    # contributes (0,0,0,0) rather than whatever RGB it happened to store.
    premul = np.concatenate([src[..., :3] * alpha, alpha], axis=-1)

    resized = np.asarray(
        Image.fromarray((premul * 255.0).round().astype(np.uint8), "RGBA").resize(
            size, Image.LANCZOS
        ),
        dtype=np.float64,
    ) / 255.0

    # Undo the premultiply, clamping instead of dividing by ~zero coverage.
    out_alpha = resized[..., 3:4]
    safe_alpha = np.where(out_alpha <= 0.0, 1.0, out_alpha)
    out_rgb = np.where(out_alpha > 0.0, resized[..., :3] / safe_alpha, 0.0)

    out = np.concatenate([out_rgb, out_alpha], axis=-1)
    return Image.fromarray((out * 255.0).round().clip(0, 255).astype(np.uint8), "RGBA")


def main() -> int:
    if not os.path.exists(SRC):
        print(f"error: master logo not found at {SRC}", file=sys.stderr)
        return 1

    logo = Image.open(SRC).convert("RGBA")
    mark = logo.crop(MARK_BOX)

    # Fit the mark inside the target box, preserving its aspect ratio.
    target = int(CANVAS * FILL)
    scale = min(target / mark.width, target / mark.height)
    new_size = (max(1, round(mark.width * scale)), max(1, round(mark.height * scale)))
    mark = resize_premultiplied(mark, new_size)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(
        mark,
        ((CANVAS - mark.width) // 2, (CANVAS - mark.height) // 2),
        mark,  # mask again: pasting RGBA without a mask would drop the alpha
    )

    canvas.save(OUT, "PNG", optimize=True)
    size_kb = os.path.getsize(OUT) / 1024
    print(
        f"wrote {os.path.relpath(OUT, ROOT)} — {canvas.width}x{canvas.height}, "
        f"mark {mark.width}x{mark.height}, {size_kb:.1f} KB"
    )

    # The favicon and the 32px PNG used to be the full lockup squeezed into
    # 60px, which left the "VEXIM" wordmark as unreadable mush at tab size.
    # Re-derive both from the clean mark so every brand asset in the repo comes
    # from this one source.
    build_small_icons(canvas)
    return 0


def build_small_icons(mark_canvas: Image.Image) -> None:
    """Emit public/favicon.ico and public/icon-32.png from the clean mark."""
    favicon_path = os.path.join(ROOT, "public", "favicon.ico")
    # LANCZOS all the way down: at 16px the mark's gradient bands alias badly
    # under NEAREST, and a favicon is the one asset nobody gets to zoom into.
    base = mark_canvas.resize((64, 64), Image.LANCZOS)
    base.save(
        favicon_path,
        sizes=[(16, 16), (32, 32), (48, 48)],
        format="ICO",
    )
    print(f"wrote {os.path.relpath(favicon_path, ROOT)} — 16/32/48")

    icon32_path = os.path.join(ROOT, "public", "icon-32.png")
    # app/layout.tsx advertises this as sizes="32x32", so emit it at 32 exactly.
    mark_canvas.resize((32, 32), Image.LANCZOS).save(icon32_path, "PNG", optimize=True)
    print(f"wrote {os.path.relpath(icon32_path, ROOT)} — 32x32")


if __name__ == "__main__":
    raise SystemExit(main())
