import { describe, expect, it } from 'vitest';
import { errorMessages, phaseLabel } from './messages';
import type { ErrorCode } from './types';

describe('phaseLabel', () => {
  it('numbers files from 1 and names them', () => {
    expect(phaseLabel({ kind: 'writing', index: 3, count: 4, label: 'thermostat.bin', address: 0x10000 })).toBe(
      'Écriture 4/4 · thermostat.bin',
    );
  });
  it('has a label for every other phase and for no phase yet', () => {
    expect(phaseLabel(null)).toBe('Préparation…');
    expect(phaseLabel({ kind: 'connecting' })).toBe('Connexion à la carte');
    expect(phaseLabel({ kind: 'erasing' })).toBe('Effacement des zones');
    expect(phaseLabel({ kind: 'verifying' })).toBe('Vérification');
    expect(phaseLabel({ kind: 'resetting' })).toBe('Redémarrage de la carte');
  });
});

describe('errorMessages', () => {
  it('has a French title and explanation for every code', () => {
    const codes: ErrorCode[] = [
      'cancelled',
      'target-not-found',
      'invalid-plan',
      'family-mismatch',
      'device-error',
      'already-running',
    ];
    for (const code of codes) {
      expect(errorMessages[code].title.length).toBeGreaterThan(0);
      expect(errorMessages[code].explanation.length).toBeGreaterThan(0);
    }
  });
});
