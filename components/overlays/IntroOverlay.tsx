'use client';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { DialogBox } from '@/components/overlays/DialogBox';

export function IntroOverlay() {
  const phase = useGame(s => s.phase);
  const next = useGame(s => s.next);
  const dialog = useDataStore(s => s.dialog);
  if (phase !== 'intro' || !dialog) return null;
  return <DialogBox npcName={dialog.doctor.name} lines={dialog.intro} onDone={next} />;
}
