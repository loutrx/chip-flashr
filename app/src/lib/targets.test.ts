import { describe, expect, it } from 'vitest';
import { target } from './app/fixtures';
import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { boardName } from './targets';

describe('boardName', () => {
  it('names simulated boards in the UI language', () => {
    expect(boardName(target(), fr)).toBe('Carte simulée · ESP32-S3');
    expect(boardName(target(), en)).toBe('Simulated board · ESP32-S3');
  });

  it('keeps the label of a real board as the backend reported it', () => {
    expect(boardName(target({ id: 'serial:COM4', label: 'ESP32-S3 · COM4' }), fr)).toBe('ESP32-S3 · COM4');
  });
});
