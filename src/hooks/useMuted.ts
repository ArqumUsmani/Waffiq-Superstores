import { useSyncExternalStore } from 'react';
import { isMuted, onAudioChange } from '../lib/sfx';

/**
 * The mute flag, read straight from the audio module.
 *
 * There are two mute buttons now — one in the header, one on the hero — and
 * a local `useState` in each would let them disagree the moment the other
 * was used. Subscribing both to the same source keeps them showing one
 * state. `onAudioChange` also fires on the first-gesture unlock, which does
 * not change the flag; the snapshot comparison makes that a no-op.
 */
export function useMuted(): boolean {
  return useSyncExternalStore(onAudioChange, isMuted, () => false);
}
