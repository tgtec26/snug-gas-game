#!/usr/bin/env bash
# Codex CLI(ChatGPT 구독 로그인)의 내장 이미지 생성으로 그림 한 장을 만든다. API 키 불필요, 사용량은 ChatGPT 요금제 한도에 포함.
#
#   scripts/gen_image.sh <저장할 경로.png> "<요청 문구>" [참고 그림 ...]
#
# 예) scripts/gen_image.sh docs/assets-source/rbc/walk-v2.png "첨부한 시트에 ... 추가" ~/Downloads/모자\ 추가.png
# - 참고 그림을 주면 그 그림을 보고 편집·참고해서 만든다.
# - 저장할 경로에 파일이 이미 있으면 덮어쓰지 않고 멈춘다.
# - 결과는 원본 보관용 PNG. 게임에 넣을 때는 WebP 변환(scripts/slice_rbc_sheet.py 등)을 따로 한다.
set -euo pipefail

if [ $# -lt 2 ]; then sed -n '2,10p' "$0"; exit 1; fi
out="$1"; prompt="$2"; shift 2
[ -e "$out" ] && { echo "이미 있음: $out (덮어쓰지 않음)"; exit 1; }
command -v codex >/dev/null || { echo "codex CLI가 없습니다: npm i -g @openai/codex@latest"; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
imgs=()
for ref in "$@"; do
  [ -f "$ref" ] || { echo "참고 그림 없음: $ref"; exit 1; }
  cp "$ref" "$work/"; imgs+=("--image=$work/$(basename "$ref")")  # = 형식: -i 뒤 여러 값 받기가 요청 문구를 삼키지 않게
done

instr="Use the built-in image_gen tool only (never the CLI fallback, never an API key). Generate exactly one image for this request:

$prompt

If reference images are attached, look at them first and follow them. When done, copy the generated PNG from \$CODEX_HOME/generated_images into the current directory as result.png, then reply with DONE."

echo "Codex에 요청 중… (1~3분)"
if ! codex exec --skip-git-repo-check -s workspace-write -C "$work" ${imgs[@]+"${imgs[@]}"} -o "$work/last.txt" "$instr" > "$work/run.log" 2>&1; then
  echo "Codex 실패:"; grep -E "ERROR|error" "$work/run.log" | sort -u | head -5; exit 1
fi
[ -f "$work/result.png" ] || { echo "결과 파일이 없습니다. 로그:"; tail -20 "$work/run.log"; exit 1; }
mkdir -p "$(dirname "$out")"
mv "$work/result.png" "$out"
echo "저장: $out"
