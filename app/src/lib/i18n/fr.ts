import type { ProvisionalId } from '../app/screen';
import type { StepKind } from '../flashState';
import type { ErrorCode, SourceKind } from '../types';

/** A probable cause on the failure screen, and what to do about it. */
export type Cause = { title: string; detail: string };

/** `at` is "pendant l’écriture, à 41 %" (failure.at), or null when the job never reported progress. */
type ErrorText = { title: string; explanation: (at: string | null) => string; causes: Cause[] };

/** A list item that ends with a code chip, such as a connector name. */
export type StepWithCode = { text: string; code: string };

/** "l’ESP32-S3" but "le STM32F411", "le nRF52840": the article elides before a vowel letter. */
function onChip(chip: string): string {
  return /^[aeiou]/i.test(chip) ? `l’${chip}` : `le ${chip}`;
}

const errors: Record<ErrorCode, ErrorText> = {
  cancelled: {
    title: 'Programmation annulée',
    explanation: (at) =>
      `Vous avez arrêté l’opération${at ? ` ${at}` : ''}. Vous pouvez relancer quand vous voulez.`,
    causes: [],
  },
  'target-not-found': {
    title: 'Carte introuvable',
    explanation: (at) =>
      `La carte a été débranchée ou n’est plus détectée${at ? ` ${at}` : ''}. Rebranchez-la puis réessayez.`,
    causes: [
      { title: 'La carte a été débranchée.', detail: 'Rebranchez-la, attendez qu’elle apparaisse, puis réessayez.' },
      {
        title: 'Le câble ne transmet que le courant.',
        detail: 'Certains câbles servent seulement à charger : essayez un câble de données.',
      },
    ],
  },
  'invalid-plan': {
    title: 'Firmware invalide',
    explanation: () => 'Le firmware est incomplet ou ses zones se chevauchent. Demandez un nouveau paquet.',
    causes: [
      {
        title: 'Le paquet est incomplet ou abîmé.',
        detail: 'Demandez un nouveau paquet à la personne qui vous l’a envoyé.',
      },
    ],
  },
  'family-mismatch': {
    title: 'Mauvais type de puce',
    explanation: () => 'Ce firmware ne correspond pas à la carte branchée.',
    causes: [
      { title: 'Le type de puce choisi est incorrect.', detail: 'Revenez à l’accueil et choisissez le bon type de puce.' },
      { title: 'Ce n’est pas la carte prévue.', detail: 'Vérifiez que vous avez branché la carte indiquée dans les instructions.' },
    ],
  },
  'device-error': {
    title: 'La programmation a échoué',
    explanation: (at) =>
      `La carte a cessé de répondre${at ? ` ${at}` : ''}. Elle n’est pas endommagée : vous pouvez relancer.`,
    causes: [
      { title: 'Le câble a bougé ou est défectueux.', detail: 'Rebranchez-le fermement, ou essayez un autre câble.' },
      { title: 'L’alimentation est insuffisante.', detail: 'Évitez les hubs USB non alimentés.' },
    ],
  },
  'already-running': {
    title: 'Programmation déjà en cours',
    explanation: () => 'Attendez la fin de l’opération en cours.',
    causes: [],
  },
};

export const fr = {
  topbar: {
    modeGroup: 'Mode d’affichage',
    simple: 'Simple',
    expert: 'Expert',
    settings: 'Réglages',
    noBoard: 'Aucune carte',
  },
  pill: {
    board: (chip: string, port: string) => `${chip} · ${port}`,
    busy: (chip: string) => `${chip} · programmation…`,
    error: (chip: string) => `${chip} · erreur`,
    missingDriver: 'Pilote manquant',
    locked: (chip: string) => `${chip} · verrouillée`,
    missingTool: (chip: string) => `${chip} · outil manquant`,
  },
  families: {
    label: 'Type de puce',
    esp32: { name: 'ESP32', description: 'Espressif · S2, S3, C3, C6, H2' },
    stm32: { name: 'STM32', description: 'STMicroelectronics · sonde ou USB' },
    nrf: { name: 'nRF', description: 'Nordic · nRF51 à nRF91' },
    detected: 'Détecté automatiquement',
    toChoose: 'À choisir',
    suggested: 'Suggéré',
    reason: {
      startAddress: (address: string, family: string) =>
        `Les adresses commencent à ${address}, ce qui correspond d’habitude à un ${family}. Confirmez le type de puce pour continuer.`,
      fileName: (family: string) =>
        `Le nom du fichier évoque un ${family}. Confirmez le type de puce pour continuer.`,
    },
  },
  board: {
    connected: (name: string) => `${name} connectée`,
    connection: (port: string, link: string, flash: string | null) =>
      [`Port ${port}`, link, flash].filter((part) => part !== null).join(' · '),
    link: {
      usbJtag: 'USB-JTAG intégré',
      usbSerial: (bridge: string) => `USB-série ${bridge}`,
      probe: (name: string) => `sonde ${name}`,
    },
    flash: (size: string) => `flash ${size}`,
    waitingFamily: 'En attente du type de puce',
    waitingFamilyNote: 'La recherche de sonde démarre dès que vous avez choisi.',
    refresh: 'Rechercher à nouveau les cartes',
  },
  firmware: {
    label: 'Firmware à programmer',
    change: 'Changer',
    changeCount: (count: number) => `Changer · ${count} disponible${count > 1 ? 's' : ''}`,
    noVersion: 'sans version',
    noVersionInfo: 'Aucune information de version trouvée',
    ranges: (count: number) => `${count} plage${count > 1 ? 's' : ''} d’adresses`,
    builtAt: (date: string, time: string) => `compilé le ${date} à ${time}`,
    manifest: (count: number) =>
      count > 1 ? `${count} fichiers · adresses lues dans` : `${count} fichier · adresse lue dans`,
    details: 'Détails',
    source: {
      'esp-idf-build': 'Build ESP-IDF',
      arduino: 'Export Arduino',
      'platform-io': 'Build PlatformIO',
      elf: 'Fichier .elf',
      hex: 'Fichier .hex',
      bin: 'Fichier .bin',
      'file-name': 'Nom du fichier',
    } satisfies Record<SourceKind, string>,
  },
  home: {
    program: 'Programmer',
    estimate: (duration: string) => `Environ ${duration}. Ne débranchez pas la carte pendant l’opération.`,
    chooseFirst: 'Choisissez d’abord le type de puce.',
  },
  list: {
    title: 'Firmwares disponibles',
    summary: (count: number, folders: number) =>
      `${count} trouvé${count > 1 ? 's' : ''} dans ${folders} dossier${folders > 1 ? 's' : ''} · la liste se met à jour toute seule`,
    search: 'Rechercher',
    searchLabel: 'Rechercher un firmware',
    all: 'Tous',
    unidentified: 'À identifier',
    needsFamily: 'Type de puce à préciser',
    folderApp: 'dossier de l’application',
    folderWatched: 'dossier surveillé',
    addFolder: 'Ajouter un dossier surveillé',
    openFile: 'Ouvrir un fichier…',
    empty: 'Aucun firmware ne correspond à la recherche.',
    filtersLabel: 'Filtrer par type de puce',
  },
  progress: {
    title: 'Programmation en cours',
    barLabel: 'Progression de la programmation',
    cancel: 'Annuler',
    keepPlugged: 'Ne débranchez pas la carte et ne fermez pas l’application.',
    remaining: (duration: string) => `environ ${duration} restantes`,
    stepsLabel: 'Étapes de la programmation',
    fileBarLabel: (name: string) => `Progression de ${name}`,
  },
  steps: {
    connecting: 'Connexion à la carte',
    erasing: 'Effacement des zones',
    writing: (index: number, count: number, name: string) => `Écriture ${index}/${count} · ${name}`,
    verifying: 'Vérification',
    resetting: 'Redémarrage de la carte',
    done: 'Terminé',
    active: 'En cours',
    pending: 'À venir',
  },
  success: {
    title: 'Programmation réussie',
    body: (firmware: string, chip: string, port: string) =>
      `${firmware} est installé sur ${onChip(chip)} (${port}). Vous pouvez débrancher la carte.`,
    verification: 'Vérification',
    verified: 'Conforme',
    notVerified: 'Non vérifiée',
    duration: 'Durée',
    sessionBoards: 'Cartes cette session',
    again: 'Programmer une autre carte',
    report: 'Voir le rapport',
    home: 'Retour à l’accueil',
    copied: 'Copié',
  },
  startup: {
    title: 'Impossible de démarrer',
    body: 'Chip Flashr n’a pas pu lire l’état des cartes et des firmwares. Redémarrez l’application ; si le problème persiste, transmettez les détails techniques à votre fournisseur.',
  },
  failure: {
    details: 'Détails techniques',
    retry: 'Réessayer',
    export: 'Exporter le rapport',
    copied: 'Copié',
    home: 'Retour à l’accueil',
    causesTitle: 'Causes probables',
    at: (step: string, percent: string) => `pendant ${step}, à ${percent}`,
    stepNoun: {
      connecting: 'la connexion',
      erasing: 'l’effacement',
      writing: 'l’écriture',
      verifying: 'la vérification',
      resetting: 'le redémarrage',
    } satisfies Record<StepKind, string>,
  },
  errors,
  report: {
    heading: 'Rapport de programmation Chip Flashr',
    app: (version: string) => `Chip Flashr v${version}`,
    date: (date: string, time: string) => `Date : ${date} à ${time}`,
    simulated: (scenario: string) => `Simulation · scénario ${scenario}`,
    firmware: (name: string, version: string | null) =>
      version ? `Firmware : ${name} ${version}` : `Firmware : ${name} (sans version)`,
    file: (fileName: string, folder: string) => `Fichier : ${fileName} · ${folder}`,
    image: (address: string, name: string, size: string) => `  ${address}  ${name}  ${size}`,
    target: (label: string, port: string) => `Carte : ${label} sur ${port}`,
    noTarget: 'Carte : aucune',
    step: (label: string, duration: string) => `  ${label} · ${duration}`,
    success: 'Résultat : réussite',
    failure: (title: string) => `Résultat : échec · ${title}`,
    technical: 'Détails techniques :',
  },
  provisional: {
    title: {
      'waiting-board': 'Branchez la carte',
      'missing-driver': 'Un pilote USB est nécessaire',
      'external-tool': 'Un outil externe est nécessaire',
      'no-firmware': 'Aucun firmware trouvé',
      incomplete: 'Paquet incomplet',
    } satisfies Record<ProvisionalId, string>,
    body: 'Écran prévu au plan 3b.',
    recheck: 'Revérifier',
  },
  units: {
    kib: 'Ko',
    mib: 'Mo',
    seconds: (count: number) => `${count} seconde${count > 1 ? 's' : ''}`,
    minutes: (count: number) => `${count} minute${count > 1 ? 's' : ''}`,
  },
  instructions: {
    title: 'Instructions',
    live: 'Suivi en direct',
    hide: 'Masquer les instructions',
    show: 'Afficher les instructions',
    hidden: 'Instructions masquées',
    empty: {
      title: 'Aucune instruction pour ce firmware',
      body: 'Placez un fichier LISEZMOI.md, README.md ou .txt à côté de l’application ou dans le zip : il s’affichera ici et se mettra à jour dès qu’il est modifié.',
    },
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
    watching: (paths: string) => `Surveillance : ${paths}`,
    appFolder: 'dossier de l’application',
    simulated: (scenario: string) => `Simulation · scénario ${scenario}`,
    unknownScenario: (name: string) => `Scénario inconnu «\u00a0${name}\u00a0» : scénario default utilisé`,
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
