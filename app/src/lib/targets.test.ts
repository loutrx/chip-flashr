import { describe, expect, it } from 'vitest';
import { en } from './i18n/en';
import { fr } from './i18n/fr';
import { boardName } from './targets';

describe('boardName', () => {
  it('names simulated boards in the UI language', () => {
    const target = { id: 'mock:esp32', family: 'esp32', label: 'ESP32-S3' } as const;
    expect(boardName(target, fr)).toBe('Carte simulée · ESP32-S3');
    expect(boardName(target, en)).toBe('Simulated board · ESP32-S3');
  });

  it('keeps the label of a real board as the backend reported it', () => {
    const target = { id: 'serial:COM4', family: 'esp32', label: 'ESP32-S3 · COM4' } as const;
    expect(boardName(target, fr)).toBe('ESP32-S3 · COM4');
  });
});
