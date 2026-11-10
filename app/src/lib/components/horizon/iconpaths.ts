/* HORIZON'S ICONS (system/README.md § Iconography): inline stroke icons on a
   24 px grid, stroke 1.8, round caps and joins, currentColor — so a glyph
   lights sunrise with its label in one rule and needs no font. Lucide
   geometry, the same paths the boards draw. No emoji in the interface.

   Each icon is its SVG's inner markup — constant data written here, never
   anything from a trip file, so it is safe to set as HTML; a bare path's
   data stands for its <path d="…"/>, '|' between the parts — and decorative
   by default (aria-hidden), because every control that carries one also
   carries a word or a label. */
export const I: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4"/>|M12 2v2|M12 20v2|m4.93 4.93 1.41 1.41|m17.66 17.66 1.41 1.41|M2 12h2|M20 12h2|m6.34 17.66-1.41 1.41|m19.07 4.93-1.41 1.41',
  route: '<circle cx="6" cy="19" r="3"/>|M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15|<circle cx="18" cy="5" r="3"/>',
  pouch: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1|M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
  search: '<circle cx="11" cy="11" r="7"/>|m20 20-3.5-3.5',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  check: 'M20 6 9 17l-5-5',
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-up': 'm18 15-6-6-6 6',
  alert: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3|M12 9v4|M12 17h.01',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/>|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  counter: '<rect x="5" y="2" width="14" height="20" rx="2"/>|M9 7h6|M9 11h6|M9 15h3',
  ticket: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z|M13 5v2|M13 17v2|M13 11v2',
  plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  train: '<rect x="4" y="3" width="16" height="16" rx="2"/>|M4 11h16|M12 3v8|m8 19-2 3|m18 22-2-3|M8 15h.01|M16 15h.01',
  car: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2|<circle cx="7" cy="17" r="2"/>|M9 17h6|<circle cx="17" cy="17" r="2"/>',
  /* a leg's way of going (the day's route): walk · taxi (car) · metro (train) */
  walk: 'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z|M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z|M16 17h4|M4 13h4',
  bed: 'M2 4v16|M2 8h18a2 2 0 0 1 2 2v10|M2 17h20|M6 8v9',
  card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/>|M3 10h18',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/>|m22 7-10 6L2 7',
  external: 'M15 3h6v6|M10 14 21 3|M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z|<circle cx="12" cy="10" r="3"/>',
  close: 'M18 6 6 18|m6 6 12 12',
  device: '<rect x="6" y="2" width="12" height="20" rx="2.5"/>|M11 18h2',
  handset: '<rect x="5" y="2" width="14" height="20" rx="2"/>|M12 18h.01',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z|m9 12 2 2 4-4',
  gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z|<circle cx="12" cy="12" r="3"/>',
  plus: 'M12 5v14|M5 12h14',
  download: 'M12 3v12|m7 10 5 5 5-5|M5 21h14',
  cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
  'cloud-up': 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z|M12 13v5|m9.5 15.5 2.5-2.5 2.5 2.5',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8|m16 6-4-4-4 4|M12 2v13',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/>|M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8|M10 12h4',
  'arrow-right': 'M5 12h14|m13 6 6 6-6 6',
  edit: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z|m15 5 4 4',
  trash: 'M3 6h18|M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6|M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
  doc: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z|M14 2v4a2 2 0 0 0 2 2h4',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/>|<circle cx="9" cy="9" r="2"/>|m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21',
  clock: '<circle cx="12" cy="12" r="10"/>|M12 6v6l4 2',
  coins: 'M12 2v20|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z|M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27',
  info: '<circle cx="12" cy="12" r="10"/>|M12 16v-4|M12 8h.01',
  note: 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z|M15 3v4a2 2 0 0 0 2 2h4',
  speech: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  swap: 'm16 3 4 4-4 4|M20 7H4|m8 21-4-4 4-4|M4 17h16',
  list: 'M9 6h12|M9 12h12|M9 18h12|M4 6h.01|M4 12h.01|M4 18h.01',
  pack: 'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z|M8 10h8|M8 18h8|M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2',
  passport: '<rect x="4" y="2" width="16" height="20" rx="2"/>|<circle cx="12" cy="10" r="3"/>|M8 17h8',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/>|M16 2v4|M8 2v4|M3 10h18',
  eye: 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0|<circle cx="12" cy="12" r="3"/>',
  dots: '<circle cx="12" cy="12" r="1"/>|<circle cx="19" cy="12" r="1"/>|<circle cx="5" cy="12" r="1"/>',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9|M10.3 21a1.94 1.94 0 0 0 3.4 0',
  snow: 'M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2|M8 15h.01|M8 19h.01|M12 17h.01|M12 21h.01|M16 15h.01|M16 19h.01',
  rain: 'M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2|M16 14v6|M8 14v6|M12 16v6',
  star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z',
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z',
  pause: '<rect x="6" y="5" width="4.5" height="14" rx="1.5"/>|<rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/>',
  replay: 'M3 12a9 9 0 1 0 3-6.7|M3 4v5h5|M10.5 9.2v5.6l4.5-2.8z',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  utensils: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2|M7 2v20|M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  /* the Map tab in the nav (Map 5c, map4-map); the map's own glyphs —
     the category set, its controls — live with the map (lib/map/icons.ts) */
  map: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z|M15 5.764v15|M9 3.236v15',
};

/** The path data of an icon's bare paths — what the map's glyphs (lib/map/icons.ts) borrow
    where they draw the same thing, so one drawing is shipped once. */
export const iconPaths = (name: string): string[] => I[name]!.split('|').filter((p) => p[0] != '<');
