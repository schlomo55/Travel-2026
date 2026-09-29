/* THE MAP THAT CANNOT START (Map 5d, lib/map/street/index.ts) — the review's
   MEDIUM finding 5 and LOW finding 8. A `new maplibregl.Map()` that threw (no
   WebGL) still RESOLVED `openStreetMap`, with every method then working on an
   undefined map: the screen's first `setPins` threw inside an effect, and
   with no boundary the Map tab crashed. A map whose worker never starts never
   loads, and the screen said "Opening the map…" for ever. And the rebuild
   after a lost WebGL context had the same hole.

   Here the controller runs on a stand-in engine (the real one needs WebGL): a
   Map class whose constructor throws, or never fires `load`, or loads. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => {
  type Fn = (e?: unknown) => void;
  type Pad = { top: number; bottom: number; left: number; right: number };
  const state = {
    mode: 'ok' as 'ok' | 'throw' | 'never',
    throwOn: new Set<number>(),
    made: 0,
    removed: 0,
    live: null as unknown,
    /* what the map has drawn, as queryRenderedFeatures answers (Map 5f) */
    features: [] as unknown[],
  };
  class FakeMap {
    private on_ = new Map<string, { f: Fn; once: boolean }[]>();
    /* Map 5f: a gesture under way, the zoom, the padding and the camera calls, as a test sets and reads them */
    moving = false;
    zoom = 13;
    padding: Pad = { top: 0, bottom: 0, left: 0, right: 0 };
    jumps: { center?: unknown; padding?: Pad }[] = [];
    paddings: Pad[] = [];
    layers: { id: string; layout?: Record<string, unknown> }[] = [];
    constructor(o: { container?: { lay?: (tag: string) => void } }) {
      state.made++;
      /* as maplibre does: the canvas and its boxes go in before WebGL is asked for */
      o.container?.lay?.('maplibregl-canvas-container');
      if (state.mode === 'throw' || state.throwOn.has(state.made)) throw new Error('Failed to initialize WebGL');
      state.live = this;
      if (state.mode === 'ok') queueMicrotask(() => this.fire('load'));
    }
    on(type: string, a: unknown, b?: unknown): this {
      const f = (typeof a === 'function' ? a : b) as Fn;
      this.on_.set(type, [...(this.on_.get(type) ?? []), { f, once: false }]);
      return this;
    }
    once(type: string, f: Fn): this {
      this.on_.set(type, [...(this.on_.get(type) ?? []), { f, once: true }]);
      return this;
    }
    fire(type: string, e: unknown = {}): void {
      const list = this.on_.get(type) ?? [];
      this.on_.set(
        type,
        list.filter((h) => !h.once),
      );
      for (const h of list) h.f(e);
    }
    setPadding(p: Pad): void {
      this.paddings.push(p);
      this.padding = p;
    }
    getPadding() {
      return this.padding;
    }
    getContainer() {
      return { clientWidth: 412, clientHeight: 915 };
    }
    unproject(pt: [number, number]) {
      return { lng: pt[0], lat: pt[1] };
    }
    hasImage(): boolean {
      return false;
    }
    addImage(): void {}
    addSource(): void {}
    addLayer(l: { id: string; layout?: Record<string, unknown> }): void {
      this.layers.push(l);
    }
    getLayer(): boolean {
      return true;
    }
    getSource() {
      return { setData: () => {}, getClusterExpansionZoom: async () => 15 };
    }
    setPaintProperty(): void {}
    getCenter() {
      return { lng: 116.3871, lat: 39.938 };
    }
    getZoom(): number {
      return this.zoom;
    }
    getBearing(): number {
      return 0;
    }
    getBounds() {
      return { getWest: () => 116.3, getSouth: () => 39.9, getEast: () => 116.5, getNorth: () => 40 };
    }
    project() {
      return { x: 206, y: 400 };
    }
    getCanvas() {
      return { style: {}, clientWidth: 412, clientHeight: 915 };
    }
    isMoving(): boolean {
      return this.moving;
    }
    /* as maplibre's: a jump fires its move events there and then */
    jumpTo(o: { center?: unknown; padding?: Pad }): void {
      this.jumps.push(o);
      if (o.padding) this.padding = o.padding;
      this.fire('movestart');
      this.fire('move');
      this.fire('moveend');
    }
    flyTo(): void {}
    easeTo(): void {}
    stop(): void {}
    queryRenderedFeatures(): unknown[] {
      return state.features;
    }
    remove(): void {
      state.removed++;
      if (state.live === this) state.live = null;
    }
  }
  class FakeMarker {
    setLngLat(): this {
      return this;
    }
    setRotation(): this {
      return this;
    }
    addTo(): this {
      return this;
    }
    remove(): void {}
  }
  return { state, lib: { Map: FakeMap, Marker: FakeMarker, getVersion: () => 'stand-in', addProtocol: () => {} } };
});

vi.mock('#map-engine', () => ({ default: engine.lib }));
vi.mock('../lib/map/street/fonts', () => ({ loadMapFonts: async () => {}, STACK: { regular: 'r', bold: 'b', italic: 'i', mono: 'm' } }));
vi.mock('../lib/map/street/pins', () => ({ clusterImage: () => ({}), PIN_GLYPHS: ['sight'], pinImage: () => ({}), poiDot: () => ({}), PR: 2, PR_PHOTO: 2, PHOTO_LABEL_EM: 2.5, photoPinImage: () => ({}) }));
vi.mock('../lib/map/street/style', () => ({ horizonStyle: () => ({ version: 8, sources: {}, layers: [] }), palette: () => ({ ink: '#fff', ink2: '#ccc', land: '#000' }) }));

let vis: Set<() => void>;
const doc = {
  hidden: false,
  documentElement: { classList: { contains: () => false } },
  addEventListener: (_t: string, f: () => void) => vis.add(f),
  removeEventListener: (_t: string, f: () => void) => vis.delete(f),
};
const options = (onError = vi.fn()) => ({
  container: { dataset: {} } as unknown as HTMLElement,
  pack: null,
  center: [116.3871, 39.938] as [number, number],
  zoom: 13,
  label: 'Street map',
  onPin: () => {},
  onView: () => {},
  onGesture: () => {},
  onError,
});

beforeEach(() => {
  vis = new Set();
  doc.hidden = false;
  engine.state.mode = 'ok';
  engine.state.throwOn = new Set();
  engine.state.made = 0;
  engine.state.removed = 0;
  engine.state.features = [];
  vi.stubGlobal('document', doc);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the map that cannot start', () => {
  it('no WebGL (the constructor throws): openStreetMap rejects — no half-made map to crash on, nothing left in the container', async () => {
    const { openStreetMap } = await import('../lib/map/street');
    engine.state.mode = 'throw';
    const kids: { cls: string; remove(): void }[] = [];
    const classes = new Set<string>();
    const container = {
      get children() {
        return kids;
      },
      classList: { remove: (c: string) => classes.delete(c) },
      lay(cls: string) {
        classes.add('maplibregl-map');
        const k = { cls, remove: () => kids.splice(kids.indexOf(k), 1) };
        kids.push(k);
      },
    };
    await expect(openStreetMap({ ...options(), container: container as unknown as HTMLElement })).rejects.toThrow(/WebGL/);
    expect(vis.size).toBe(0); // nothing left listening
    expect(kids).toHaveLength(0); // its canvas box taken out again
    expect(classes.has('maplibregl-map')).toBe(false);
  });

  it('a map that never loads (its worker never starts): rejects after START_MS, and is taken down', async () => {
    vi.useFakeTimers();
    const { openStreetMap, START_MS } = await import('../lib/map/street');
    engine.state.mode = 'never';
    const opening = openStreetMap(options());
    const verdict = expect(opening).rejects.toThrow(/did not load/);
    await vi.advanceTimersByTimeAsync(START_MS - 1);
    expect(engine.state.removed).toBe(0);
    await vi.advanceTimersByTimeAsync(2);
    await verdict;
    expect(engine.state.removed).toBe(1);
    expect(START_MS).toBe(15_000);
  });

  it('a map that loads resolves, as before', async () => {
    const { openStreetMap } = await import('../lib/map/street');
    const s = await openStreetMap(options());
    expect(s.engine).toBe('stand-in');
    expect(s.view().zoom).toBe(13);
    s.destroy();
    expect(vis.size).toBe(0);
  });

  it('a lost context whose rebuild fails: the screen is told once, and every method is safe after', async () => {
    vi.useFakeTimers();
    const { openStreetMap } = await import('../lib/map/street');
    const onError = vi.fn();
    const s = await openStreetMap(options(onError));
    const first = engine.state.live as { fire(t: string): void };
    first.fire('webglcontextlost');
    engine.state.throwOn.add(2); // the second map cannot be made
    for (const f of [...vis]) f(); // the app is shown again
    await vi.advanceTimersByTimeAsync(1000);
    expect(engine.state.made).toBe(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0]?.[0])).toMatch(/WebGL/);
    /* what the Map screen calls, all on a map that is not there */
    const el = {} as HTMLElement;
    expect(() => {
      s.setPins([{ id: 'a', lng: 116.39, lat: 39.94, cat: 'sight', glyph: 'sight', label: 'A', v: '' }]);
      s.setSelected('a');
      s.setYou({ lng: 116.39, lat: 39.94, accuracy: 25 });
      s.setRings(false);
      const m = s.marker(el, [116.39, 39.94]);
      m.move([116.4, 39.95]);
      m.rotate(90);
      m.remove();
      s.flyTo([116.4, 39.95], 15);
      s.panTo([116.4, 39.95]);
      s.fit([
        [116.39, 39.94],
        [116.4, 39.95],
      ]);
      s.zoomBy(1);
      s.northUp();
      s.setPadding({ top: 1, bottom: 2, left: 3, right: 4 });
    }).not.toThrow();
    expect(Number.isNaN(s.project([116.4, 39.95]).x)).toBe(true);
    expect(s.view().lat).toBeCloseTo(39.938, 3); // the last view it had
    expect(() => s.destroy()).not.toThrow();
  });
});

/* MAP 5F — what the map tells the screen about its pins, and the fold that keeps the view. */
type Live = {
  moving: boolean;
  zoom: number;
  padding: { top: number; bottom: number; left: number; right: number };
  jumps: { center?: unknown; padding?: unknown }[];
  paddings: unknown[];
  layers: { id: string; layout?: Record<string, unknown> }[];
  fire(t: string, e?: unknown): void;
};

describe('the fold keeps the view — also mid-fling, and the rail hears it moved nothing (Map 5f)', () => {
  const room = { top: 126, bottom: 206, left: 16, right: 72 };
  it('folding while a fling still glides: the change waits for the move to end, then keeps what is on the screen', async () => {
    const { openStreetMap } = await import('../lib/map/street');
    const { roomMiddle } = await import('../lib/logic/wayfind');
    const s = await openStreetMap(options());
    const m = engine.state.live as Live;
    const before = m.paddings.length;
    m.moving = true; // the fling, gliding
    s.setPadding(room, true);
    s.setPadding({ ...room, bottom: 205 }, false); // the foot box measuring itself again, a moment later
    expect(m.jumps).toHaveLength(0);
    expect(m.paddings).toHaveLength(before);
    m.moving = false;
    m.fire('moveend');
    /* 5e applied the padding plainly here, and the map's centre jumped to the new room's middle */
    expect(m.paddings).toHaveLength(before);
    expect(m.jumps).toHaveLength(1);
    const [x, y] = roomMiddle({ ...room, bottom: 205 }, 412, 915);
    expect(m.jumps[0]).toEqual({ center: { lng: x, lat: y }, padding: { ...room, bottom: 205 } });
    /* once: a later move's end does nothing more */
    m.fire('moveend');
    expect(m.jumps).toHaveLength(1);
    s.destroy();
  });
  it('the view a fold makes says so (`kept`), a real move does not — the rail sorts again only for a real one', async () => {
    const { openStreetMap } = await import('../lib/map/street');
    const views: { kept?: boolean }[] = [];
    const s = await openStreetMap({ ...options(), onView: (v) => views.push(v) });
    const m = engine.state.live as Live;
    views.length = 0;
    s.setPadding(room, true);
    expect(views.length).toBeGreaterThan(0);
    expect(views.every((v) => v.kept === true)).toBe(true);
    views.length = 0;
    m.fire('move'); // a hand on the map
    expect(views).toHaveLength(1);
    expect(views[0]!.kept).toBeUndefined();
    /* and a padding that is not kept (a place's sheet opening) is no fold */
    views.length = 0;
    s.setPadding({ ...room, bottom: 400 });
    expect(views.some((v) => v.kept)).toBe(false);
    s.destroy();
  });
});

describe('the pins the map drew, and which wear their photo (Map 5f)', () => {
  const feature = (id: string, v: '' | 'today' | 'tonight', label: string, ph: 0 | 1) => ({ properties: { id, cat: 'sight', glyph: 'sight', v, label, ph }, geometry: { coordinates: [116.39, 39.94] } });
  const cluster = { properties: { point_count: 3, cluster_id: 7, sight: 3 }, geometry: { coordinates: [116.4, 39.95] } };
  const drawnAt = async (zoom: number) => {
    const { openStreetMap } = await import('../lib/map/street');
    const seen: { ids: Set<string>; at: { x: number; y: number; photo?: boolean; chars?: number }[]; photos: Set<string> }[] = [];
    const container = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    const s = await openStreetMap({ ...options(), container, onDrawn: (ids, at, photos) => seen.push({ ids, at, photos }) });
    const m = engine.state.live as Live;
    m.zoom = zoom;
    engine.state.features = [feature('kau-kee', '', 'Kau Kee', 1), feature('bed', 'tonight', 'The Pottinger', 1), feature('pmq', '', 'PMQ', 0), cluster];
    m.fire('idle');
    s.destroy();
    return { d: seen.at(-1)!, data: (container as unknown as { dataset: Record<string, string> }).dataset };
  };
  it('close in (z15.5): the photo pins are said to wear their photo, with their names’ length — tonight’s has no map name', async () => {
    const { d, data } = await drawnAt(15.5);
    expect([...d.ids].sort()).toEqual(['bed', 'kau-kee', 'pmq']);
    expect([...d.photos].sort()).toEqual(['bed', 'kau-kee']);
    expect(d.at).toEqual([
      { x: 206, y: 400, photo: true, chars: 7 },
      { x: 206, y: 400, photo: true },
      { x: 206, y: 400, chars: 3 },
      { x: 206, y: 400 },
    ]);
    expect(data.photos).toBe('2');
    expect(data.at).toBe('206,400,1,7 206,400,1,0 206,400,0,3 206,400');
  });
  it('further out (z14.5): icons — nothing wears its photo', async () => {
    const { d, data } = await drawnAt(14.5);
    expect(d.photos.size).toBe(0);
    expect(d.at.some((q) => q.photo)).toBe(false);
    expect(data.photos).toBe('0');
  });
  it('the style draws the pins’ image and their names’ offset with the one zoom rule the screen reads back', async () => {
    const { openStreetMap } = await import('../lib/map/street');
    const { photoPinStep, PHOTO_PIN_ZOOM } = await import('../lib/logic/placephotos');
    const s = await openStreetMap(options());
    const pins = (engine.state.live as Live).layers.find((l) => l.id === 'pins')!;
    for (const k of ['icon-image', 'text-offset']) {
      const rule = pins.layout![k] as unknown[];
      expect(rule.slice(0, 2)).toEqual(['step', ['zoom']]);
      expect(rule[3]).toBe(PHOTO_PIN_ZOOM);
      expect(rule).toEqual(photoPinStep(rule[2], rule[4]));
    }
    s.destroy();
  });
});
