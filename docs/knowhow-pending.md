# KNOWHOW 대기 항목

`snug-game-principles/KNOWHOW.md`에 아직 옮기지 못한 항목. 같은 형식으로 적었으니 옮길 때 번호만 붙인다.

### E12. game.destroy()는 씬에 shutdown 없이 destroy만 내보낸다 — 스토어 구독이 남는다

- **증상**: 개발 서버에서 코드를 고치면 화면에 `Runtime TypeError: Cannot read properties of null (reading 'queueOp')` 오류창이 떴다(`sceneRouter.ts`의 `scene.scene.start`). 대사를 넘기는 순간 phase가 바뀌며 발생했다.
- **원인**: 화면 갱신·재마운트로 Phaser 게임이 `destroy()`되면 옛 씬은 `shutdown`이 아니라 `destroy`만 겪는다. 씬 라우터가 `shutdown`에서만 스토어 구독을 풀어서, 파괴된 옛 씬의 구독이 남아 `scene.scene`(이미 null 매니저)을 호출했다.
- **해결**: 스토어를 구독하는 씬 코드는 `shutdown`과 `destroy` 둘 다에서 구독을 푼다(`scene.events.once('destroy', unsub)`). 가짜 씬에 `destroy` 이벤트를 내보내는 단위 테스트로 잡는다.
- **근거**: `snug-gas-game` 2026-10-02 `sceneRouter.ts`. **확인 수준**: 원인은 추정(옛 씬 구독이 남는 구조와 테스트 재현으로 확인), 실제 Phaser에서 destroy 뒤 phase를 바꿔도 오류 없음을 확인. 오류창이 뜬 순간의 정확한 호출 경로까지는 재현하지 못했다.
