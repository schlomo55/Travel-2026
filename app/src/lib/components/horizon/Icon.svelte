<script lang="ts" module>
  /* HORIZON'S ICONS (system/README.md § Iconography): inline stroke icons on a
     24 px grid, stroke 1.8, round caps and joins, currentColor — so a glyph
     lights sunrise with its label in one rule and needs no font. Lucide
     geometry, the same paths the boards draw. No emoji in the interface.

     Each icon is a list of primitives; decorative by default (aria-hidden),
     because every control that carries one also carries a word or a label. */
  type Prim = { d: string } | { c: [number, number, number] } | { r: [number, number, number, number, number] };

  const I: Record<string, Prim[]> = {
    sun: [
      { c: [12, 12, 4] },
      { d: 'M12 2v2' },
      { d: 'M12 20v2' },
      { d: 'm4.93 4.93 1.41 1.41' },
      { d: 'm17.66 17.66 1.41 1.41' },
      { d: 'M2 12h2' },
      { d: 'M20 12h2' },
      { d: 'm6.34 17.66-1.41 1.41' },
      { d: 'm19.07 4.93-1.41 1.41' },
    ],
    route: [{ c: [6, 19, 3] }, { d: 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' }, { c: [18, 5, 3] }],
    pouch: [
      { d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1' },
      { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' },
    ],
    search: [{ c: [11, 11, 7] }, { d: 'm20 20-3.5-3.5' }],
    phone: [
      {
        d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
      },
    ],
    check: [{ d: 'M20 6 9 17l-5-5' }],
    'chevron-right': [{ d: 'm9 18 6-6-6-6' }],
    'chevron-left': [{ d: 'm15 18-6-6 6-6' }],
    'chevron-down': [{ d: 'm6 9 6 6 6-6' }],
    'chevron-up': [{ d: 'm18 15-6-6-6 6' }],
    alert: [
      { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
      { d: 'M12 9v4' },
      { d: 'M12 17h.01' },
    ],
    copy: [{ r: [9, 9, 12, 12, 2] }, { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }],
    counter: [{ r: [5, 2, 14, 20, 2] }, { d: 'M9 7h6' }, { d: 'M9 11h6' }, { d: 'M9 15h3' }],
    ticket: [
      { d: 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z' },
      { d: 'M13 5v2' },
      { d: 'M13 17v2' },
      { d: 'M13 11v2' },
    ],
    plane: [
      {
        d: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
      },
    ],
    train: [
      { r: [4, 3, 16, 16, 2] },
      { d: 'M4 11h16' },
      { d: 'M12 3v8' },
      { d: 'm8 19-2 3' },
      { d: 'm18 22-2-3' },
      { d: 'M8 15h.01' },
      { d: 'M16 15h.01' },
    ],
    car: [
      {
        d: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2',
      },
      { c: [7, 17, 2] },
      { d: 'M9 17h6' },
      { c: [17, 17, 2] },
    ],
    bed: [{ d: 'M2 4v16' }, { d: 'M2 8h18a2 2 0 0 1 2 2v10' }, { d: 'M2 17h20' }, { d: 'M6 8v9' }],
    card: [{ r: [3, 5, 18, 14, 2.5] }, { d: 'M3 10h18' }],
    mail: [{ r: [2, 4, 20, 16, 2] }, { d: 'm22 7-10 6L2 7' }],
    external: [
      { d: 'M15 3h6v6' },
      { d: 'M10 14 21 3' },
      { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' },
    ],
    pin: [{ d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z' }, { c: [12, 10, 3] }],
    close: [{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }],
    device: [{ r: [6, 2, 12, 20, 2.5] }, { d: 'M11 18h2' }],
    handset: [{ r: [5, 2, 14, 20, 2] }, { d: 'M12 18h.01' }],
    shield: [
      {
        d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
      },
      { d: 'm9 12 2 2 4-4' },
    ],
    gear: [
      {
        d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
      },
      { c: [12, 12, 3] },
    ],
    plus: [{ d: 'M12 5v14' }, { d: 'M5 12h14' }],
    download: [{ d: 'M12 3v12' }, { d: 'm7 10 5 5 5-5' }, { d: 'M5 21h14' }],
    cloud: [{ d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' }],
    'cloud-up': [
      { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' },
      { d: 'M12 13v5' },
      { d: 'm9.5 15.5 2.5-2.5 2.5 2.5' },
    ],
    moon: [{ d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }],
    share: [{ d: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' }, { d: 'm16 6-4-4-4 4' }, { d: 'M12 2v13' }],
    archive: [{ r: [2, 3, 20, 5, 1] }, { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' }, { d: 'M10 12h4' }],
    'arrow-right': [{ d: 'M5 12h14' }, { d: 'm13 6 6 6-6 6' }],
    edit: [
      {
        d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
      },
      { d: 'm15 5 4 4' },
    ],
    trash: [
      { d: 'M3 6h18' },
      { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' },
      { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' },
    ],
    doc: [{ d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }, { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    image: [
      { r: [3, 3, 18, 18, 2] },
      { c: [9, 9, 2] },
      { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' },
    ],
    clock: [{ c: [12, 12, 10] }, { d: 'M12 6v6l4 2' }],
    globe: [{ c: [12, 12, 10] }, { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }, { d: 'M2 12h20' }],
    coins: [{ d: 'M12 2v20' }, { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' }],
    heart: [
      {
        d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
      },
      { d: 'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27' },
    ],
    info: [{ c: [12, 12, 10] }, { d: 'M12 16v-4' }, { d: 'M12 8h.01' }],
    note: [{ d: 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z' }, { d: 'M15 3v4a2 2 0 0 0 2 2h4' }],
    speech: [{ d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' }],
    swap: [{ d: 'm16 3 4 4-4 4' }, { d: 'M20 7H4' }, { d: 'm8 21-4-4 4-4' }, { d: 'M4 17h16' }],
    list: [
      { d: 'M9 6h12' },
      { d: 'M9 12h12' },
      { d: 'M9 18h12' },
      { d: 'M4 6h.01' },
      { d: 'M4 12h.01' },
      { d: 'M4 18h.01' },
    ],
    pack: [
      { d: 'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z' },
      { d: 'M8 10h8' },
      { d: 'M8 18h8' },
      { d: 'M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' },
    ],
    passport: [{ r: [4, 2, 16, 20, 2] }, { c: [12, 10, 3] }, { d: 'M8 17h8' }],
    calendar: [{ r: [3, 4, 18, 18, 2] }, { d: 'M16 2v4' }, { d: 'M8 2v4' }, { d: 'M3 10h18' }],
    eye: [{ d: 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0' }, { c: [12, 12, 3] }],
    dots: [{ c: [12, 12, 1] }, { c: [19, 12, 1] }, { c: [5, 12, 1] }],
    grid: [{ r: [3, 3, 7, 7, 1.5] }, { r: [14, 3, 7, 7, 1.5] }, { r: [3, 14, 7, 7, 1.5] }, { r: [14, 14, 7, 7, 1.5] }],
    ticketline: [{ d: 'M3 7h18' }, { d: 'M3 12h18' }, { d: 'M3 17h12' }],
  };

  export type IconName = keyof typeof I;
  export function hasIcon(name: string): boolean {
    return name in I;
  }
</script>

<script lang="ts">
  let {
    name,
    size = 20,
    stroke = 1.8,
    label,
    class: cls = '',
  }: {
    name: string;
    size?: number;
    stroke?: number;
    /** Only for an icon that stands alone as meaning; controls label themselves. */
    label?: string;
    class?: string;
  } = $props();

  const prims = $derived(I[name] ?? []);
</script>

<svg
  class="hicon {cls}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  {#each prims as p, i (i)}
    {#if 'd' in p}<path d={p.d} />{:else if 'c' in p}<circle cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />{:else}<rect
        x={p.r[0]}
        y={p.r[1]}
        width={p.r[2]}
        height={p.r[3]}
        rx={p.r[4]}
      />{/if}
  {/each}
</svg>

<style>
  .hicon {
    flex-shrink: 0;
    display: block;
  }
</style>
