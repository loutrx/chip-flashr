import type { ErrorCode } from '../types';

type ErrorText = { title: string; explanation: string };

/** A list item that ends with a code chip, such as a connector name. */
export type StepWithCode = { text: string; code: string };

export const fr = {
  topbar: {
    modeGroup: 'Mode d’affichage',
    simple: 'Simple',
    expert: 'Expert',
    settings: 'Réglages',
    noBoard: 'Aucune carte',
  },
  families: {
    label: 'Type de puce',
    esp32: { name: 'ESP32', description: 'Espressif · S2, S3, C3, C6, H2' },
    stm32: { name: 'STM32', description: 'STMicroelectronics · sonde ou USB' },
    nrf: { name: 'nRF', description: 'Nordic · nRF51 à nRF91' },
  },
  board: {
    simulated: (chip: string) => `Carte simulée · ${chip}`,
    connected: (name: string) => `${name} connectée`,
    demoNote: 'Démo : aucune vraie carte n’est programmée.',
  },
  demo: {
    program: 'Programmer',
    hint: 'Quelques secondes sur la carte simulée.',
    listError: 'Impossible de lister les cartes.',
  },
  progress: {
    title: 'Programmation en cours',
    barLabel: 'Progression de la programmation',
    cancel: 'Annuler',
    keepPlugged: 'Ne débranchez pas la carte et ne fermez pas l’application.',
  },
  phase: {
    preparing: 'Préparation…',
    connecting: 'Connexion à la carte',
    erasing: 'Effacement des zones',
    writing: (index: number, count: number, label: string) => `Écriture ${index}/${count} · ${label}`,
    verifying: 'Vérification',
    resetting: 'Redémarrage de la carte',
  },
  success: {
    title: 'Programmation réussie',
    body: (board: string) => `${board} est programmée. Vous pouvez la débrancher.`,
    verification: 'Vérification',
    verified: 'Conforme',
    notVerified: 'Non vérifiée',
    duration: 'Durée',
    size: 'Écrit',
    again: 'Programmer une autre carte',
    home: 'Retour à l’accueil',
  },
  failure: {
    details: 'Détails techniques',
    retry: 'Réessayer',
    home: 'Retour à l’accueil',
  },
  errors: {
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
  } satisfies Record<ErrorCode, ErrorText>,
  units: { kib: 'Ko' },
  instructions: {
    title: 'Instructions',
    live: 'Suivi en direct',
    hide: 'Masquer les instructions',
    show: 'Afficher les instructions',
    hidden: 'Instructions masquées',
    // Sample content until plan 4 renders the real README.
    sample: {
      file: 'LISEZMOI.md',
      heading: 'Mise à jour du thermostat',
      intro: 'Durée : environ 2 minutes. Aucune connaissance technique requise.',
      beforeTitle: 'Avant de commencer',
      before: [
        'Coupez l’alimentation secteur du boîtier.',
        'Utilisez un câble USB-C de données, pas un câble de charge seule.',
      ],
      stepsTitle: 'Étapes',
      steps: [
        'Retirez la trappe arrière (2 vis).',
        { text: 'Branchez le câble sur le connecteur', code: 'J3 · PROG' },
        'Cliquez sur Programmer.',
        'Attendez « Programmation réussie », puis débranchez.',
      ] as (string | StepWithCode)[],
      image: 'Image du README : connecteur J3',
      warning: 'Ne débranchez jamais le câble pendant la programmation.',
      helpTitle: 'Besoin d’aide ?',
      help: '[VOTRE CONTACT SUPPORT]',
    },
  },
  status: {
    demo: 'Démo · carte simulée',
  },
  settings: {
    title: 'Réglages',
    back: 'Retour',
    general: 'Général',
    language: 'Langue',
    theme: 'Thème',
    themeSystem: 'Comme le système',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    about: (version: string) => `Chip Flashr v${version} · Apache-2.0`,
  },
  expert: {
    title: 'Mode Expert',
    body: 'Le mode Expert arrive dans une prochaine version : fichiers et adresses, table de partitions, journal.',
    back: 'Revenir au mode Simple',
  },
};

export type Messages = typeof fr;
