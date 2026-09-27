import type { Messages } from './i18n/fr';
import type { Target } from './types';

/** Simulated boards (`mock:…`) are named as such in the UI language; real ones keep the backend's label (spec D8). */
export function boardName(target: Target, m: Messages): string {
  return target.id.startsWith('mock:') ? m.board.simulated(target.label) : target.label;
}
