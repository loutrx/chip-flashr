import type { ScreenId } from './app/screen';
import type { Tone } from './components/tones';
import type { Messages } from './i18n/fr';
import type { DeviceIssue, ErrorCode, Link, Target } from './types';

/** How the board is attached, as the board card and the report word it: "USB-JTAG intégré", "sonde ST-Link". */
export function linkText(link: Link, m: Messages): string {
  switch (link.kind) {
    case 'usb-jtag':
      return m.board.link.usbJtag;
    case 'usb-serial':
      return m.board.link.usbSerial(link.bridge);
    case 'probe':
      return m.board.link.probe(link.name);
  }
}

/** What the top-bar pill shows. `text: null` means nothing is known yet (the loading screen). */
export interface PillState {
  tone: Tone;
  text: string | null;
  breathe: boolean;
}

function noBoard(m: Messages): PillState {
  return { tone: 'idle', text: m.topbar.noBoard, breathe: false };
}

/**
 * The spec's pill table ("Top-bar pill per screen"). A screen that names the board falls back to "Aucune carte" without one.
 * `code` is the error of a failed job: a cancel is the user's own doing, so the board stays neutral.
 */
export function pillText(
  screen: ScreenId,
  target: Target | null,
  issue: DeviceIssue | null,
  m: Messages,
  code?: ErrorCode,
): PillState {
  switch (screen) {
    case 'loading':
      return { tone: 'idle', text: null, breathe: false };
    case 'home':
    case 'firmware-list':
    case 'incomplete':
    case 'success':
      return target ? { tone: 'ok', text: m.pill.board(target.label, target.port), breathe: true } : noBoard(m);
    case 'choose-chip':
    case 'waiting-board':
    case 'no-firmware':
      return noBoard(m);
    case 'programming':
      return target ? { tone: 'busy', text: m.pill.busy(target.label), breathe: true } : noBoard(m);
    case 'failure':
      if (target && code === 'cancelled') return { tone: 'ok', text: m.pill.board(target.label, target.port), breathe: false };
      return target ? { tone: 'err', text: m.pill.error(target.label), breathe: false } : noBoard(m);
    case 'missing-driver':
      return { tone: 'warn', text: m.pill.missingDriver, breathe: false };
    case 'external-tool':
      if (issue?.kind !== 'missing-tool') return noBoard(m);
      return {
        tone: 'warn',
        text: issue.locked ? m.pill.locked(issue.targetLabel) : m.pill.missingTool(issue.targetLabel),
        breathe: false,
      };
  }
}
