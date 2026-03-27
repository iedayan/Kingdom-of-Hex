#!/usr/bin/env python3
"""Build itch.io-ready JPEGs from screenshots.

Searches (first match wins):
  1) public/itch/inbox/*.png|.jpg|.jpeg
  2) public/*.png|.jpg|.jpeg (top-level only; ignores public/itch/)
  3) ./Screenshot*.png (repo root)

Outputs:
  public/itch/cover-630x500.jpg — center-crop to 630×500 (itch recommended)
  public/itch/gallery-NN.jpg    — max side 1920px, compressed

Requires: Pillow (pip install pillow)
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUT = ROOT / 'public' / 'itch'
INBOX = OUT / 'inbox'


def find_sources() -> list[Path]:
    """Collect source images in priority order."""
    if INBOX.is_dir():
        found = (
            sorted(INBOX.glob('*.png'))
            + sorted(INBOX.glob('*.jpg'))
            + sorted(INBOX.glob('*.jpeg'))
        )
        if found:
            return found

    if PUBLIC.is_dir():
        found = []
        for pattern in ('*.png', '*.jpg', '*.jpeg'):
            for p in sorted(PUBLIC.glob(pattern)):
                if p.is_file():
                    found.append(p)
        if found:
            return found

    return sorted(ROOT.glob('Screenshot*.png'))


def crop_to_aspect(im: Image.Image, target_w: int, target_h: int) -> Image.Image:
    ta = target_w / target_h
    w, h = im.size
    if w / h > ta:
        nh = h
        nw = int(round(h * ta))
        x0 = (w - nw) // 2
        return im.crop((x0, 0, x0 + nw, h))
    nw = w
    nh = int(round(w / ta))
    y0 = (h - nh) // 2
    return im.crop((0, y0, w, y0 + nh))


def make_cover(src: Path, dest: Path, size: tuple[int, int] = (630, 500), quality: int = 88) -> None:
    im = Image.open(src).convert('RGB')
    im = crop_to_aspect(im, size[0], size[1])
    im = im.resize(size, Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, 'JPEG', quality=quality, optimize=True)


def make_gallery(src: Path, dest: Path, max_side: int = 1920, quality: int = 82) -> None:
    im = Image.open(src).convert('RGB')
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    im.save(dest, 'JPEG', quality=quality, optimize=True)


def main() -> int:
    sources = find_sources()
    if not sources:
        print(
            'No images found. Use public/*.png,',
            INBOX,
            'or Screenshot*.png in repo root.',
            file=sys.stderr,
        )
        return 1

    OUT.mkdir(parents=True, exist_ok=True)

    preferred = [p for p in sources if '2.34.57' in p.name]
    cover_src = preferred[0] if preferred else sources[0]
    make_cover(cover_src, OUT / 'cover-630x500.jpg')
    print('cover:', OUT / 'cover-630x500.jpg', '←', cover_src.name)

    for i, p in enumerate(sources, 1):
        dest = OUT / f'gallery-{i:02d}.jpg'
        make_gallery(p, dest)
        print('gallery:', dest.name, '←', p.name)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
