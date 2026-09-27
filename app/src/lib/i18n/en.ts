import type { Messages } from './fr';

export const en: Messages = {
  topbar: {
    modeGroup: 'Display mode',
    simple: 'Simple',
    expert: 'Expert',
    settings: 'Settings',
    noBoard: 'No board',
  },
  families: {
    label: 'Chip type',
    esp32: { name: 'ESP32', description: 'Espressif · S2, S3, C3, C6, H2' },
    stm32: { name: 'STM32', description: 'STMicroelectronics · probe or USB' },
    nrf: { name: 'nRF', description: 'Nordic · nRF51 to nRF91' },
  },
  board: {
    simulated: (chip) => `Simulated board · ${chip}`,
    connected: (name) => `${name} connected`,
    demoNote: 'Demo: no real board is programmed.',
  },
  demo: {
    program: 'Program',
    hint: 'A few seconds on the simulated board.',
    listError: 'Could not list the boards.',
  },
  progress: {
    title: 'Programming',
    barLabel: 'Programming progress',
    cancel: 'Cancel',
    keepPlugged: 'Do not unplug the board or close the app.',
  },
  phase: {
    preparing: 'Preparing…',
    connecting: 'Connecting to the board',
    erasing: 'Erasing',
    writing: (index, count, label) => `Writing ${index}/${count} · ${label}`,
    verifying: 'Verifying',
    resetting: 'Restarting the board',
  },
  success: {
    title: 'Programming complete',
    body: (board) => `${board} is programmed. You can unplug it.`,
    verification: 'Verification',
    verified: 'Passed',
    notVerified: 'Not verified',
    duration: 'Duration',
    size: 'Written',
    again: 'Program another board',
    home: 'Back to home',
  },
  failure: {
    details: 'Technical details',
    retry: 'Try again',
    home: 'Back to home',
  },
  errors: {
    cancelled: {
      title: 'Programming cancelled',
      explanation: 'You stopped the operation. You can start again whenever you like.',
    },
    'target-not-found': {
      title: 'Board not found',
      explanation: 'The board was unplugged or is no longer detected. Plug it back in and try again.',
    },
    'invalid-plan': {
      title: 'Invalid firmware',
      explanation: 'The firmware is incomplete or its regions overlap. Ask for a new package.',
    },
    'family-mismatch': {
      title: 'Wrong chip type',
      explanation: 'This firmware does not match the connected board.',
    },
    'device-error': {
      title: 'Programming failed',
      explanation: 'The board stopped responding. It is not damaged: you can try again.',
    },
    'already-running': {
      title: 'Programming already in progress',
      explanation: 'Wait for the current operation to finish.',
    },
  },
  units: { kib: 'KB' },
  instructions: {
    title: 'Instructions',
    live: 'Live',
    hide: 'Hide instructions',
    show: 'Show instructions',
    hidden: 'Instructions hidden',
    sample: {
      file: 'README.md',
      heading: 'Thermostat update',
      intro: 'Takes about 2 minutes. No technical knowledge needed.',
      beforeTitle: 'Before you start',
      before: ['Switch off the mains power to the unit.', 'Use a USB-C data cable, not a charge-only cable.'],
      stepsTitle: 'Steps',
      steps: [
        'Remove the back cover (2 screws).',
        { text: 'Plug the cable into connector', code: 'J3 · PROG' },
        'Click Program.',
        'Wait for “Programming complete”, then unplug.',
      ],
      image: 'README image: connector J3',
      warning: 'Never unplug the cable while programming.',
      helpTitle: 'Need help?',
      help: '[YOUR SUPPORT CONTACT]',
    },
  },
  status: {
    demo: 'Demo · simulated board',
  },
  settings: {
    title: 'Settings',
    back: 'Back',
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    themeSystem: 'Same as system',
    themeLight: 'Light',
    themeDark: 'Dark',
    about: (version) => `Chip Flashr v${version} · Apache-2.0`,
  },
  expert: {
    title: 'Expert mode',
    body: 'Expert mode comes in a later version: files and addresses, partition table, log.',
    back: 'Back to Simple mode',
  },
};
