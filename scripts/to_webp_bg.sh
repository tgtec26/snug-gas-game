#!/usr/bin/env bash
# 배경 원본 PNG → 게임용 WebP (1600×1000, quality 85).  사용: scripts/to_webp_bg.sh <원본.png> <출력.webp>
set -euo pipefail
mkdir -p "$(dirname "$2")"
cwebp -quiet -q 85 -resize 1600 1000 "$1" -o "$2"
echo "$2 $(du -h "$2" | cut -f1)"
