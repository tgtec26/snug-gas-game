# 시작 화면 캐릭터 선택 + 이름 입력 (2026-10-02, 사용자 승인)

근거: `snug-game-principles` CLAUDE.md 7번 "시작 화면에서 진행 캐릭터 선택 + 이름 입력"(2026-10-02 추가). 선례: `snug-force-park-game`.

## 화면

```
        중1 과학 · 기체의 성질
           공기 진료소
   [ 남학생 ]  [ 여학생1 ]  [ 여학생2 ]     카드 탭 / 좌우 화살표
   [ 이름 입력칸        ] [ 진료 시작 ]      한 줄
              [ 진료 기록부 ]
```

- 캐릭터 3명(남 1, 여 2)은 모두 흰 가운 차림의 견습 공기 의사(스펙 7장 주인공). 머리 모양과 안쪽 옷 색으로 구별한다.
- 첫 카드가 기본 선택. 이름이 비어 있으면 시작할 수 없다(버튼 흐림, 누르면 입력칸으로 포커스).
- 입력칸 placeholder는 "이름". 기본 이름·예시 이름 없음. 앞뒤 공백 제거, 최대 글자 수는 `minigame-config.json`의 `hero.nameMax`(기본 8).
- 한글 조합 중 Enter는 무시. 입력칸 Enter는 시작.
- 진료 시작 터치가 곧 전체 화면 전환(기존 동작).

## 저장

- `game/store.ts`의 진행 상태(`RUN_KEY`)에 `heroId`, `playerName`을 함께 저장한다. `start(name, heroId)`만 값을 바꾼다.
- "처음으로"(reset) 뒤에도 이름과 캐릭터는 남아 시작 화면에 채워진다.
- 이름 없이 진행 중이던 예전 저장본은 시작 화면으로 돌려보낸다.

## 게임 전체 반영

- 대사: `dialog-config.json`에 `{name}` 토큰. `DialogBox`가 치환한다. 조사가 붙지 않는 문형("{name} 선생님")만 쓴다.
- 담그기 장면(`DipScene`): 고정 그림 `props/kid.webp` 자리에 선택한 캐릭터(`hero_<id>` 텍스처).
- 결과 카드(`SummaryOverlay`, PNG 포함): 캐릭터 얼굴과 "견습 공기 의사 {name}".

## 그림

- `hero/boy.webp`: 기존 `props/kid.webp`를 옮긴 것(바이트 동일).
- `hero/girl1.webp`, `hero/girl2.webp`: codex로 생성. boy를 참고 그림으로 넣어 자세·비율·가운을 맞춘다(보안경·장갑 겹침 위치 공유).
- 원본 시트는 `docs/assets-source/hero_girls_sheet.png`, 프롬프트는 `docs/art-todo.md`.

## 데이터·어드민

- `minigame-config.json`에 `hero: { nameMax, cardSize }`(미니게임 탭). 그림 경로는 `manifest.json`(에셋 탭).

## 검증

- 테스트: 빈 이름 시작 불가, 공백 제거, reset 뒤 이름·캐릭터 유지, 이름 없는 저장본 복원, `hero` 설정 검증.
- 브라우저: 1280×800과 폰 가로(844×390)에서 시작 화면, 인트로 대사, 담그기(3명 각각 보안경·장갑 위치), 결과 카드.

## 하지 않는 것

- 미리보기 하단 스테이지 네비게이터(규칙 7번의 별도 항목), 직함 승급(스펙 7장).
