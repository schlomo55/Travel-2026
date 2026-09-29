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
  const state = { mode: 'ok' as 'ok' | 'throw' | 'never', throwOn: new Set<number>(), made: 0, removed: 0, live: null as unknown };
  class FakeMap {
    private on_ = new Map<string, Fn[]>();
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
      this.on_.set(type, [...(this.on_.get(type) ?? []), f]);
      return this;
    }
    once(type: string, f: Fn): this {
      return this.on(type, f);
    }
    fire(type: string, e: unknown = {}): void {
      for (const f of this.on_.get(type) ?? []) f(e);
    }
    setPadding(): void {}
    getPadding() {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }
    hasImage(): boolean {
      return false;
    }
    addImage(): void {}
    addSource(): void {}
    addLayer(): void {}
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
      return 13;
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
      return false;
    }
    jumpTo(): void {}
    flyTo(): void {}
    easeTo(): void {}
    stop(): void {}
    queryRenderedFeatures(): unknown[] {
      return [];
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
  container: {} as HTMLElement,
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
