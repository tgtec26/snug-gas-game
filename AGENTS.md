# AGENTS

> AI 코딩 에이전트가 이 저장소에서 작업할 때 따라야 할 지침.

## 전역 개발 지침
이 시리즈의 모든 게임은 `tgtec26/snug-game-principles`의 `CLAUDE.md`(수업용 과학 게임 대원칙 10개 항목)를 따른다. 클라우드 세션에서는 `add_repo`로 그 저장소를 붙여 읽고, 로컬에서는 사용자의 전역 `CLAUDE.md`가 같은 내용이다. 완료 전 10번 자체 점검표로 스스로 검사한다.

## 현재 상태 (2026-09-30)
**설계 스펙 v1 승인됨(2026-09-30), 구현 계획서 작성됨. Task 1~4 완료**(뼈대, 타입·데이터·검증기, 판정 규칙, 상태·도감). 화면과 조작 장면은 아직 없고 다음은 Task 5(엔진 이식 + 타이틀·인트로)다. 사용자가 직접 고른 것은 게임 구조(문진 없애기), 원인 단서(사연 장면 + 재현), 입자 보기(엑스레이 렌즈 끌어 대기) 세 가지이고, 나머지 7개 결정은 가안 추천안을 일괄 확정했다.

- 계획서 [docs/superpowers/plans/2026-09-30-gas-mvp.md](docs/superpowers/plans/2026-09-30-gas-mvp.md)의 태스크 순서대로 구현한다. 체크박스가 진행 상태다.
- 순서: 뼈대(Task 1) → 타입·데이터·규칙·상태(Task 2~4) → 화면·조작 장면(Task 5~14) → 피드백·admin(Task 15~16) → 1280×800 완주 QA(Task 17).

## 작업을 이어받으면
1. [PROGRESS.md](PROGRESS.md)에서 상태 확인.
2. 스펙 [docs/superpowers/specs/2026-09-30-g1-gas-design.md](docs/superpowers/specs/2026-09-30-g1-gas-design.md) — 조작 장면 6개, 환자 9명, 한 판 10분 내외(추정), 부록 B에 전역 지침 대조표. 가안(`*-draft.md`)은 결정 과정의 기록이며 문진·진단서 퀴즈·별도 엑스레이 화면은 폐지되었다.
3. 교과서 근거는 [발췌·정리본](docs/superpowers/specs/2026-09-30-g1-gas-textbook.md) (Ⅵ. 기체의 성질 194~223쪽). 쓰지 않는 말과 "확인 필요" 표시도 거기 있다. 원문 마크다운은 구글 드라이브에만 있고 **저장소에 커밋하지 않는다**(사용자 결정 2026-09-30, 원문이 저작물이고 저장소가 공개라서). 발췌·정리본과 쪽수 인용만 쓴다. `docs/textbook/`은 만들지 않는다.
4. "확인 필요"로 표시된 값(압력–부피 그래프 점, 211쪽 온도–부피 표·그래프 등)은 원본 그림을 사람이 확인하기 전까지 게임 데이터로 확정하지 않는다. 화면에는 수치를 쓰지 않고 계기 바늘·점의 높낮이·곡선 모양만 쓴다. 교과서에 없는 수치·식·개념을 지어내지 않는다.
5. 용어는 "기체 입자", "운동의 빠르기", "보일 법칙", "샤를 법칙", "압력 센서"를 쓴다. 분자·원자·켈빈·파스칼·정비례·밀도·부력은 쓰지 않는다.
6. 그림은 SVG 코드로 만든 플레이스홀더로 게임을 끝까지 완성한 뒤 codex 이미지로 하나씩 교체한다. 사용자가 직접 그려야 하는 벡터가 꼭 필요할 때만 `docs/art-todo.md`에 적어 요청한다. 이모지 금지.
7. 뼈대를 만들 때 dev 포트는 3506 (혈액 3000, 암석 3100, 전기 3200, 물질의 특성 3300, 물질의 구성 3400).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
