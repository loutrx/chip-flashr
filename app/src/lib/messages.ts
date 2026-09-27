import type { ErrorCode, Phase } from './types';

export const errorMessages: Record<ErrorCode, { title: string; explanation: string }> = {
  cancelled: {
    title: 'Programmation annulée',
    explanation: 'Vous avez arrêté l’opération. Vous pouvez relancer quand vous voulez.',
  },
  'target-not-found': {
    title: 'Carte introuvable',
    explanation: 'La carte a été débranchée ou n’est plus détectée. Rebranchez-la puis réessayez.',
  },
  'invalid-plan': {
    title: 'Firmware invalide',
    explanation: 'Le firmware est incomplet ou ses zones se chevauchent. Demandez un nouveau paquet.',
  },
  'family-mismatch': {
    title: 'Mauvais type de puce',
    explanation: 'Ce firmware ne correspond pas à la carte branchée.',
  },
  'device-error': {
    title: 'La programmation a échoué',
    explanation: 'La carte a cessé de répondre. Elle n’est pas endommagée : vous pouvez relancer.',
  },
  'already-running': {
    title: 'Programmation déjà en cours',
    explanation: 'Attendez la fin de l’opération en cours.',
  },
};

export function phaseLabel(phase: Phase | null): string {
  if (!phase) return 'Préparation…';
  switch (phase.kind) {
    case 'connecting':
      return 'Connexion à la carte';
    case 'erasing':
      return 'Effacement des zones';
    case 'writing':
      return `Écriture ${phase.index + 1}/${phase.count} · ${phase.label}`;
    case 'verifying':
      return 'Vérification';
    case 'resetting':
      return 'Redémarrage de la carte';
  }
}
