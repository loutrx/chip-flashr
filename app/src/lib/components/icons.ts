/** One SVG element of an icon, on a 24 × 24 grid. */
export type Shape =
  | readonly ['path', string]
  | readonly ['circle', number, number, number]
  | readonly ['rect', number, number, number, number, number];

export const ICONS = {
  chip: [
    ['rect', 6, 6, 12, 12, 2],
    ['path', 'M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4'],
  ],
  sliders: [
    ['path', 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12'],
    ['circle', 16, 6, 2],
    ['circle', 10, 12, 2],
    ['circle', 18, 18, 2],
  ],
  chevronRight: [['path', 'm9 6 6 6-6 6']],
  chevronLeft: [['path', 'm15 6-6 6 6 6']],
  refresh: [
    ['path', 'M20 12a8 8 0 1 1-2.34-5.66L20 8.5'],
    ['path', 'M20 3.5v5h-5'],
  ],
  zap: [['path', 'M13 2 4 14h7l-1 8 9-12h-7z']],
  book: [
    ['path', 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z'],
    ['path', 'M4 21V5M8 7h7M8 11h5'],
  ],
  panelRight: [
    ['rect', 3, 4, 18, 16, 2],
    ['path', 'M15 4v16'],
  ],
  file: [
    ['path', 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z'],
    ['path', 'M14 3v5h5'],
  ],
  warning: [
    ['path', 'M12 3.5 2.5 20h19z'],
    ['path', 'M12 10v4.5M12 17.2v.3'],
  ],
  eye: [
    ['path', 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'],
    ['circle', 12, 12, 3],
  ],
  info: [
    ['circle', 12, 12, 9],
    ['path', 'M12 11v5.5M12 7.7v.3'],
  ],
  plug: [['path', 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5']],
  folder: [
    ['path', 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z'],
  ],
  check: [['path', 'M20 6 9 17l-5-5']],
  package: [
    ['path', 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z'],
    ['path', 'M3 7.5 12 12l9-4.5M12 12v9'],
  ],
  download: [['path', 'M12 4v11M7 10l5 5 5-5M5 20h14']],
  upload: [['path', 'M12 16V5M7 10l5-5 5 5M5 20h14']],
  externalLink: [
    ['path', 'M14 4h6v6M20 4l-9 9'],
    ['path', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  ],
  circleCheck: [
    ['circle', 12, 12, 9],
    ['path', 'm8 12 3 3 5-6'],
  ],
  circleX: [
    ['circle', 12, 12, 9],
    ['path', 'm9 9 6 6M15 9l-6 6'],
  ],
  plus: [['path', 'M12 5v14M5 12h14']],
  trash: [['path', 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3']],
  terminal: [
    ['rect', 3, 4, 18, 16, 2],
    ['path', 'm7 9 3 3-3 3M13 15h4'],
  ],
  search: [
    ['circle', 11, 11, 7],
    ['path', 'm20 20-4-4'],
  ],
  clock: [
    ['circle', 12, 12, 9],
    ['path', 'M12 7v5l3 2'],
  ],
  x: [['path', 'M6 6l12 12M18 6 6 18']],
  lock: [
    ['rect', 5, 11, 14, 10, 1.5],
    ['path', 'M8 11V7a4 4 0 0 1 8 0v4'],
  ],
  copy: [
    ['rect', 8, 8, 12, 12, 1.5],
    ['path', 'M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'],
  ],
} satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof ICONS;
