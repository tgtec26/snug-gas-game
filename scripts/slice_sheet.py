#!/usr/bin/env python3
"""
AI 생성 캐릭터·아이템 시트(격자) → 칸별 투명 WebP.

    python3 scripts/slice_sheet.py <시트.png> <열> <행> <출력 폴더> <표시 높이의 2배 px> <이름1> <이름2> ...

- 격자를 균등 분할한 뒤 칸마다 가장 큰 불투명 덩어리의 경계 상자로 잘라낸다 (옆 칸 파편 제거).
- 배경이 투명하지 않으면(모서리가 불투명) 가장자리에서 이어진 배경색을 투명으로 바꾼다.
- 결과는 정사각형 캔버스(여백 6%) 가운데·아래 정렬, 한 변 = 지정 px, WebP quality 90.
- 이름이 '-' 인 칸은 건너뛴다.
- 환경변수 TIGHT=1 이면 정사각 캔버스 대신 그림 경계 그대로(긴 변 = 지정 px, 가로세로 비 유지).
- 환경변수 WHOLE=1 이면 칸 안의 불투명 영역 전체를 자른다 (반짝이처럼 조각이 흩어진 효과 그림용).
"""
import sys
from collections import deque
from PIL import Image


def remove_bg(img, tol=40):
    """모서리 색과 비슷하고 가장자리에서 이어진 픽셀을 투명으로 (흰·단색 배경 대비)."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    if all(c[3] < 10 for c in corners):
        return img
    bg = corners[0]
    close = lambda c: abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2]) <= tol
    seen = bytearray(w * h)
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not close(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    return img


def largest_blob_bbox(cell, thr=24):
    """알파 > thr 픽셀 중 가장 큰 연결 덩어리(8방향)의 경계 상자. 없으면 None."""
    w, h = cell.size
    a = cell.getchannel('A').load()
    seen = bytearray(w * h)
    best = None
    best_n = 0
    for sy in range(0, h):
        for sx in range(0, w):
            if seen[sy * w + sx] or a[sx, sy] <= thr:
                continue
            q = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            n = 0
            x0 = x1 = sx
            y0 = y1 = sy
            while q:
                x, y = q.popleft()
                n += 1
                x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and a[nx, ny] > thr:
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
            if n > best_n:
                best_n, best = n, (x0, y0, x1 + 1, y1 + 1)
    return best


def main(src, cols, rows, out_dir, size, names):
    import os
    os.makedirs(out_dir, exist_ok=True)
    img = remove_bg(Image.open(src))
    # 속도를 위해 긴 변 1600으로 축소 후 처리
    scale = min(1.0, 1600 / max(img.size))
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    cw, ch = img.width / cols, img.height / rows
    for i, name in enumerate(names):
        if name == '-':
            continue
        c, r = i % cols, i // cols
        cell = img.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
        box = cell.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox() if os.environ.get('WHOLE') else largest_blob_bbox(cell)
        if not box:
            print(f'{name}: 빈 칸 — 건너뜀')
            continue
        # 덩어리 상자에서 약간 넓혀 잘라 가장자리 안티앨리어싱 보존 (다른 덩어리는 투명 처리)
        fig = cell.crop(box)
        if os.environ.get('TIGHT'):   # 정사각 캔버스 없이 그림 경계 그대로, 긴 변 = size (UI 바탕·문·카드처럼 가로세로 비가 다른 그림용)
            k = size / max(fig.size)
            fig.resize((max(1, round(fig.width * k)), max(1, round(fig.height * k))), Image.LANCZOS).save(os.path.join(out_dir, f'{name}.webp'), 'WEBP', quality=90, method=6)
            print(f'{name}: {fig.size} -> long side {size}px')
            continue
        side = round(max(fig.size) * 1.12)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(fig, ((side - fig.width) // 2, side - fig.height - round(side * 0.04)), fig)
        canvas = canvas.resize((size, size), Image.LANCZOS)
        path = os.path.join(out_dir, f'{name}.webp')
        canvas.save(path, 'WEBP', quality=90, method=6)
        print(f'{path} {fig.size} -> {size}px')


if __name__ == '__main__':
    if len(sys.argv) < 7:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5]), sys.argv[6:])
