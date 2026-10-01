import { create } from 'zustand';

/** 화면에 겹쳐 뜨는 보조 창(진료 기록부). 진행 상태가 아니라서 game/store와 따로 둔다(저장하지 않음). */
interface UIState { dexOpen: boolean; openDex: () => void; closeDex: () => void }
export const useUI = create<UIState>()(set => ({
  dexOpen: false, openDex: () => set({ dexOpen: true }), closeDex: () => set({ dexOpen: false }),
}));
