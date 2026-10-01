# 입력 견고성·성공 피드백 점검 기록

지침 6번(입력 견고성)·7번(성공 피드백) 점검. 헤드리스 크롬(Playwright 대신 Claude 브라우저 창)에서 1280×800으로 실제 조작해 확인한 것과 코드·테스트로만 확인한 것을 구분해 적는다. **실제 터치·크롬북은 아직 확인하지 못했다.**

## 입력 견고성 (2026-10-01)

| 항목 | 방법 | 결과 |
|---|---|---|
| Enter 연타: 인트로 | 타이틀 클릭 직후 Enter 15회 연속 | phase가 `intro`에 머문다(0.7초 입력 잠금) |
| Enter 연타: 진단서·사연·요약 | `useLock`(0.7~1.2초)과 store의 phase 가드. `tests/store.test.ts`의 "Enter 연타" 항목 | 같은 액션을 두 번 불러도 한 번만 진행. 화면 연타는 브라우저로 확인하지 않음 |
| 키 자동 반복 | 모든 씬·오버레이의 keydown에서 `e.repeat` 무시. 구슬 흔들기는 같은 키 연타도 무시 | 구슬 흔들기·검사 장치 키보드 확인 |
| 캔버스 밖에서 손 떼기 | `pointerupoutside`·BLUR 처리. 검사 장치는 Task 7 때 밖에서 놓기 확인(3회) | 해제됨. 다른 씬은 같은 코드 |
| 진료 도중 새로고침 | exam 중 새로고침 | 사연 장면부터 재시작, 클리어 기록·도감 유지. 응급실은 처음부터 |
| 응급실 늦은 입력 | `recordRound(id, ok)`가 현재 환자 id·라운드 시작 여부를 확인. 스토어 테스트 | 시간 초과 뒤 늦게 도착한 성공이 다음 환자로 새지 않음 |
| 주사기를 놓치는 경우 | 담그기 진료의 주사기는 놓은 자리에 머문다(물리적으로 놓임). 비커 벽은 옆으로 막아 낀 채 끝나지 않는다. 다이얼·피스톤은 항상 값이 정해진다 | 원위치로 돌아가는 동작은 없다. 장비 아이콘을 사람 밖에 놓으면 제자리에 남는다 |

## 성공 피드백 층

| 장면 | 시각 | 소리 | 움직임 |
|---|---|---|---|
| 눈금 하나 읽기 (측정) | 초록 점 팝, 그래프 점 팝, 반짝임 | 딸깍(`tick`) | 점이 튀어 오름 |
| 재현 단계 성공 | 화면 번쩍임, 반짝임 | 정답음 | 환자 모양이 한 번 튀어 오름 |
| 진료 성공 | 반짝임 26개, 별 | 성공음 | 진단서에서 법칙 도장이 쿵 |
| 법칙 도장 | 도장이 커졌다 찍힘 | 쿵(`stamp`), 성공음 | 카메라 살짝 흔들림(구슬 흔들기 카드) |
| 응급실 연속 성공 | 콤보 숫자 팝 | 콤보에 따라 올라가는 성공음 | 숫자가 튀어 오름 |
| 구슬 흔들기 완료 | 번쩍임·폭죽 | 팡파르 | 화면 흔들림, 도장 |
| 피날레 | 로켓 발사, 빛 폭발, 파티클, 별 카운트업 | 발사(`launch`) → 팡파르(`fanfare`) | 화면 흔들림·번쩍임 |
| 실패 | 짧은 붉은 번쩍임, 한 줄 힌트 | 오류음 | 비커·조절기가 짧게 흔들림 |

## 새 효과음 7종

`~/agent/game-audio`(local-game-audio-studio, Stable Audio Open)로 만들었다. 이 맥의 ffmpeg가 깨져 있어(`libx265` 없음) `soundfile`로 mp3(mono, 44.1kHz)로 저장했다. **소리는 귀로 듣고 고르지 못했다** — 시드 한 개로 한 번 만든 결과라 어색하면 다시 만들어야 한다.

| 슬롯 | 파일 | 프롬프트 | 쓰는 곳 |
|---|---|---|---|
| tick | gas_tick | short crisp mechanical click, small dial notch tick, dry | 눈금 읽기 |
| piston | gas_piston | short pneumatic air whoosh hiss, piston pushing air in a syringe | 피스톤 이동 |
| splash | gas_splash | water splash, a hand dipping into a bowl of water, bubbling gurgle | 주사기를 물에 담글 때·뺄 때 |
| collide | gas_collide | tiny hard ball tapping glass wall, soft short tick | 구슬·입자 벽 충돌 |
| stamp | gas_stamp | heavy rubber stamp thump on paper, short thud | 도장 |
| fanfare | gas_fanfare | short triumphant brass fanfare, celebration, cheerful | 구슬 흔들기 완료·피날레 |
| launch | gas_launch | air rocket launch, burst of air pressure release then rising whistle whoosh | 로켓 발사 |

음량·음원은 `public/data/audio-config.json`(admin 음량 탭).
