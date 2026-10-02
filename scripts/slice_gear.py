#!/usr/bin/env python3
"""
보호구 착용 시트(왼쪽부터 장갑 / 보안경 / 둘 다, 투명 배경) → 기본 그림(hero/<id>.webp)과 같은 틀의 WebP 3장.

    python3 scripts/slice_gear.py <시트.png> <id>           # 예) docs/assets-source/hero_boy_gear.png boy
    python3 scripts/slice_gear.py <그림.png> <id> --base   # 보호구 없는 기본 그림 한 장 (hero/<id>.webp를 덮어쓴다)

보호구가 달라도 변하지 않는 가슴 높이의 가운 폭과 중심, 맨 아래 선을 기본 그림에 맞춘다.
그래서 착용 그림으로 바꿔도 캐릭터가 튀지 않는다. 결과: public/assets/hero/<id>_{gloves,goggles,both}.webp
기준 그림은 hero/<id>_both.webp(있으면) 또는 hero/<id>.webp다. 틀은 가로 CANVAS_W × 세로 기준 그림 높이(640)이고, 가슴 중심을 틀의 가운데에 둔다.
포니테일·소매가 틀 끝에서 잘리지 않도록 가로를 넓게 잡았다. 화면 쪽은 높이 기준으로 크기를 정한다.
"""
import sys
from PIL import Image

CANVAS_W = 470   # 틀 가로 (세로는 기준 그림 높이 640)
CHEST = 243   # 기본 그림(640px) 맨 아래에서 가슴 높이까지의 거리 (가운 폭을 재는 줄)
NAMES = ['gloves', 'goggles', 'both']


def row_extent(alpha, y, thr=128):
    w = alpha.width
    row = alpha.crop((0, y, w, y + 1)).point(lambda v: 255 if v > thr else 0)
    return row.getbbox()  # (x0, 0, x1, 1) 또는 None


def main(sheet, hero, as_base=False):
    import os
    ref = f'public/assets/hero/{hero}_both.webp'
    base = Image.open(ref if os.path.exists(ref) else f'public/assets/hero/{hero}.webp').convert('RGBA')
    bw, bh = base.size
    be = row_extent(base.getchannel('A'), bh - CHEST)
    base_w = be[2] - be[0]
    img = Image.open(sheet).convert('RGBA')
    third = img.width / 3
    for i, name in enumerate([''] if as_base else NAMES):
        cell = img if as_base else img.crop((round(i * third), 0, round((i + 1) * third), img.height))
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
        out = Image.new('RGBA', (CANVAS_W, bh), (0, 0, 0, 0))
        out.paste(scaled, (round(CANVAS_W / 2 - cx), bh - scaled.height), scaled)
        top_clipped = scaled.height > bh
        edge = [sum(1 for y in range(bh) if out.getpixel((x, y))[3] > 128) for x in (0, CANVAS_W - 1)]
        out.save(f'public/assets/hero/{hero}{"_" + name if name else ""}.webp', 'WEBP', quality=90, method=6)
        print(f'{hero}{"_" + name if name else ""}: 배율 {s:.3f}, 폭 오차 {err:.1f}px, 키 {scaled.height}/{bh}{" (위가 잘림)" if top_clipped else ""}, 좌우 끝 불투명 {edge}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--base' in sys.argv[3:])
