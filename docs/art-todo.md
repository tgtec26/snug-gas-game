# 그림·소리 교체 목록

지금 게임은 **SVG 코드로 그린 플레이스홀더**로 끝까지 완성되어 있다. 아래 순서로 codex 그림으로 하나씩 교체한다.

## 규칙 (전역 지침 9번)

- **투명 배경(알파 채널) PNG/WebP로 처음부터 요청한다.** 불투명 배경을 받아 배경을 지우는 후처리는 금지(경계가 무너진다).
- 프롬프트에 그대로 넣을 문장: "투명 배경, 알파 채널 PNG/WebP, 배경·바닥 그림자 없음(그림자는 게임에서 따로 그림)".
- 받은 파일은 **알파 채널 유무와 가장자리**(모서리 픽셀 alpha=0, 흰 테두리·체커보드 무늬 없음)를 확인한 뒤 `public/assets/`에 넣는다. 불합격이면 후처리하지 말고 **다시 요청**한다.
- 캐릭터·아이템은 **격자 시트 한 장**으로 생성해 잘라 화풍을 통일한다(`scripts/slice_sheet.py`). 화면을 가득 채우는 배경은 투명 배경 규칙 대상이 아니다.
- 이모지 금지. 교과서에 없는 물건·글자를 그림에 넣지 않는다.

## 교체 완료 (2026-10-01, codex gpt-5.5)

모든 플레이스홀더를 codex 그림으로 교체했다. 원본은 `docs/assets-source/`, 게임용은 `public/assets/`, 목록은 `public/assets/manifest.json`(그림이 없으면 SVG·도형으로 돌아가는 곳은 환자·사연·계기·초상뿐이고, 검사 장치·담그기·구슬 흔들기·피날레 스프라이트는 그림이 있어야 한다).

| 묶음 | 파일 | 쓰는 곳 |
|---|---|---|
| 배경 | `bg/clinic`, `bg/exam`, `bg/finale` | 대기실, 검사대, 피날레 |
| 인물 | `npc/doctor` | 대사창 |
| 환자 8 + 응급실 문 | `patients/*` | 대기실, 검사 장치 고스트, 진단서 |
| 사연 장면 8 | `story/*` | 사연 장면 |
| 실험 기구 9 | `equip/*` (beaker, gauge, thermo, knob, barrel, grip, ball, lens, ice) | 검사 장치, 담그기, 구슬 흔들기, 피날레 펌프 |
| 소품 8 | `props/*` (glove, goggles, bottle, palm, rocket, pumpbody, pumphandle, pad) | 담그기, 구슬 흔들기, 피날레 |
| 진행 캐릭터 3 | `hero/*` (boy, girl1, girl2). boy는 예전 `props/kid`를 옮긴 것(2026-10-02) | 시작 화면 카드, 담그기, 결과 카드 |

변하는 부분(물 높이, 기체, 바늘, 수은, 다이얼 표시, 눈금, 입자, 섬광, 도장 글자)은 코드로 그린다. 그림은 틀(비커, 계기 바탕, 주사기 통, 손잡이 등)만 맡는다.

계정 주의: 이 계정은 기본 모델 `gpt-6.1-sol`을 지원하지 않아 `~/.codex/config.toml`을 `gpt-5.5`로 바꿨다(사용자 승인).

## 남은 것

- 견습 공기 의사 초상(쓰는 곳 없음), 입자 렌즈 안 입자(공 모양은 코드, 추상 표현이라 그대로).
- 보일·샤를 법칙 도장은 글자가 들어가서 CSS로 둔다.
- 그림 크기·위치는 `/admin` 배치 탭과 각 씬의 `setDisplaySize` 값으로 조정한다.

## 이미 교체 장치가 있는 것 (파일만 넣고 `public/assets/manifest.json`에 경로를 적으면 자동 교체)

`game/systems/render.ts`의 `ART` 표에 있는 4개. 지금 `manifest.json`은 `[]`이다.

| 경로 | 크기 | 내용 |
|---|---|---|
| `bg/clinic.webp` | 1280×800 (렌더 2560×1600 권장) | 진료소 대기실 배경. 아래쪽에 환자를 올려놓는 긴 탁자(검사대 자리) |
| `bg/exam.webp` | 1280×800 | 검사대 배경. 사선(3/4 시점) 작업대 윗면이 보이고, 뒤쪽은 벽. 장치는 게임이 그린다 |
| `npc/doctor.webp` | 투명, 정사각 | 진료소장 초상 (대사창 왼쪽) |
| `npc/apprentice.webp` | 투명, 정사각 | 견습 공기 의사 초상. 물질 분리 공방·입자 공작소의 견습생 그림을 가운만 바꿔 재사용 |

## 교체하려면 코드 연결이 더 필요한 것 (그림을 받은 뒤 `ART` 표와 해당 씬에 키를 더한다)

| 요소 | 지금 | 요청할 그림 |
|---|---|---|
| 환자 8종 (고무공, 과자 봉지, 은박 풍선, 축구공, 탁구공, 공기 침대, 열기구, 운동화) + 응급실 문 | `components/art/PatientIcon.tsx` SVG | 투명 배경 정사각 아이콘 8장(+응급실 문). **펴진 모양과 눌린 모양은 같은 그림을 게임이 늘이고 줄여** 보이므로 정면 한 장씩. 한 시트에 9칸 |
| 사연 장면 배경 8장 | `components/art/storyDecor.tsx` | 560×400 일러스트 8장(고무공 위에 앉기, 산, 추운 바깥, 겨울 들판, 찌그러진 탁구공, 공기 침대, 열기구, 착지). 글자 없음, 계기·환자는 게임이 올린다 |
| 계기 (압력 센서, 온도계) | `components/art/Gauges.tsx`, `ClinicScene` 그래픽 | 투명 배경 압력 센서 계기판(바늘 없음), 온도계 눈금 |
| 검사 장치 (주사기, 피스톤 손잡이, 비커, 온도 다이얼) | `ClinicScene`·`DipScene`이 도형으로 그림 | 투명 배경 부품 이미지. 피스톤 손잡이는 위아래로 늘어나는 막대와 따로 |
| 담그기: 뜨거운 물·얼음물 비커, 장갑, 보안경, 사람 실루엣 | `DipScene` 도형 | 투명 배경 4~5장 |
| 렌즈 아이콘 | `LensView` 도형 | 투명 배경 돋보기 |
| 구슬 흔들기: 페트병, 쇠구슬, 손바닥 | `ShakeScene` 도형 | 투명 배경 3장 |
| 피날레: 에어 로켓(페트병 로켓), 펌프, 발사대, 하늘 배경 | `FinaleScene` 도형 | 투명 배경 로켓·펌프·발사대, 하늘 배경 1장. **로켓은 위를 향해만** 그린다(사람을 향해 쏘지 않음) |
| 도장(법칙 도장), 별 | CSS·SVG | 투명 배경 도장 2장(보일 법칙·샤를 법칙) |

## 사용자가 직접 그리거나 구해야 하는 벡터

지금은 없다. 최종 결과물에 **벡터 에셋이 꼭 필요한 요소**가 생기면 여기에 목록과 규격(SVG, 단색 선 두께, 투명 배경)을 적는다.

## 소리

새 효과음 7종은 Freesound CC0 녹음(`public/assets/audio/`의 `<id>_<이름>.mp3`)으로 교체했다(`docs/principles-check.md` 참고). **귀로 듣고 고르지 못했다** — 어색한 것은 `local-game-audio-studio`의 카탈로그에서 다른 후보로 바꾼다. 배경음 3개와 정답·오답·성공음은 다른 게임의 것을 재활용한다.

## 진행 캐릭터 3명 (2026-10-02, codex gpt-5.5)

시작 화면에서 고르는 견습 공기 의사 3명(남 1, 여 2). 모두 흰 가운 차림의 허리 위 정면, 팔을 내리고 두 손이 아래에 보이는 자세다. 담그기 장면이 보안경·장갑을 같은 좌표에 겹치므로 **세 그림의 틀(387×640), 몸 중심, 허리 선이 같아야 한다**. 이름은 학생이 입력하므로 파일명·그림에 이름을 넣지 않는다.

| 파일 | 모습 |
|---|---|
| `hero/boy.webp` | 갈색 짧은 머리, 파란 티셔츠 (기존 `props/kid.webp`, 원본 `props_sheet.png`) |
| `hero/girl1.webp` | 검은 단발과 일자 앞머리, 민트색 티셔츠 |
| `hero/girl2.webp` | 갈색 높은 묶음 머리, 산호색 티셔츠 |

- 원본: `docs/assets-source/hero_girls_sheet.png` (두 명이 한 장). boy 그림을 참고 그림으로 넣어 화풍·자세·가운을 맞췄다.
- 만들기: `CODEX_MODEL=gpt-5.5 scripts/gen_image.sh docs/assets-source/hero_girls_sheet.png "<아래 프롬프트>" <boy를 PNG로 바꾼 파일>`
- 프롬프트: "Two characters side by side in ONE image. Fully transparent background (alpha channel PNG), no background, no ground shadow, no text. Both are Korean middle-school GIRLS drawn in exactly the same cartoon style, outline weight, proportions and framing as the attached reference boy: waist-up, front-facing, friendly smile, arms hanging straight down at the sides with both hands visible at the bottom, wearing the same white lab coat with a chest pocket. Girl 1 (left): short black bob hair with straight bangs, mint-green t-shirt under the coat, slightly rounder face. Girl 2 (right): brown hair tied in a high ponytail with side-swept bangs, coral-pink t-shirt under the coat, slightly slimmer face. Each girl is the same size and has the same head, eye and hand positions as the reference boy (safety goggles and gloves will be overlaid later). Leave an empty transparent gap between the two girls at least half a character wide. Nothing else in the image."
- 자르기: `slice_sheet.py`의 경계 상자 자르기는 묶음 머리 때문에 몸 중심이 틀어져 쓰지 않았다. 시트에서 몸 중심 x(girl1 416.5, girl2 1096)를 가운데로, 허리 선(y 1020)을 아래로 둔 630×1042 창을 잘라 387×640으로 줄였다(WebP quality 90).
- 계정 주의: `~/.codex/config.toml`의 기본 모델이 다시 `gpt-6.1-sol`이라 `CODEX_MODEL=gpt-5.5`를 붙여야 한다(전역 설정은 건드리지 않음).
