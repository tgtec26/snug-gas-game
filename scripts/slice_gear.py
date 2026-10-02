#!/usr/bin/env python3
"""
보호구 착용 시트(왼쪽부터 장갑 / 보안경 / 둘 다, 투명 배경) → 기본 그림(hero/<id>.webp)과 같은 틀의 WebP 3장.

    python3 scripts/slice_gear.py <시트.png> <id>     # 예) docs/assets-source/hero_boy_gear.png boy

보호구가 달라도 변하지 않는 가슴 높이의 가운 폭과 중심, 맨 아래 선을 기본 그림에 맞춘다.
그래서 착용 그림으로 바꿔도 캐릭터가 튀지 않는다. 결과: public/assets/hero/<id>_{gloves,goggles,both}.webp
"""
import sys
from PIL import Image

CHEST = 243   # 기본 그림(640px) 맨 아래에서 가슴 높이까지의 거리 (가운 폭을 재는 줄)
NAMES = ['gloves', 'goggles', 'both']


def row_extent(alpha, y, thr=128):
    w = alpha.width
    row = alpha.crop((0, y, w, y + 1)).point(lambda v: 255 if v > thr else 0)
    return row.getbbox()  # (x0, 0, x1, 1) 또는 None


def main(sheet, hero):
    base = Image.open(f'public/assets/hero/{hero}.webp').convert('RGBA')
    bw, bh = base.size
    be = row_extent(base.getchannel('A'), bh - CHEST)
    base_w, base_cx = be[2] - be[0], (be[0] + be[2]) / 2
    img = Image.open(sheet).convert('RGBA')
    third = img.width / 3
    for i, name in enumerate(NAMES):
        cell = img.crop((round(i * third), 0, round((i + 1) * third), img.height))
        box = cell.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        cell = cell.crop(box)
        a = cell.getchannel('A')
        # 가슴 줄의 가운 폭이 기본 그림과 같아지는 배율 s(시트 px / 기본 px)를 찾는다
        best = None
        for k in range(600, 3000):
            s = k / 1000
            y = round(cell.height - CHEST * s)
            if y < 0: break
            e = row_extent(a, y)
            if not e: continue
            err = abs((e[2] - e[0]) / s - base_w)
            if best is None or err < best[0]: best = (err, s, e)
        err, s, e = best
        scaled = cell.resize((round(cell.width / s), round(cell.height / s)), Image.LANCZOS)
        cx = (e[0] + e[2]) / 2 / s
        out = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        out.paste(scaled, (round(base_cx - cx), bh - scaled.height), scaled)
        top_clipped = scaled.height > bh
        out.save(f'public/assets/hero/{hero}_{name}.webp', 'WEBP', quality=90, method=6)
        print(f'{hero}_{name}: 배율 {s:.3f}, 폭 오차 {err:.1f}px, 키 {scaled.height}/{bh}{" (위가 잘림)" if top_clipped else ""}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
