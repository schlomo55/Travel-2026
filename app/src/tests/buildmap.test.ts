/* "BUILD MAP FOR THIS TRIP" ON SCREEN (7 Nov 2026) — the components rendered
   as Svelte renders them on a server (svelte/server): the markup, with no
   browser. In a browser the builder cannot work (build.protomaps.com refuses a
   web page; the app asks Android's HTTP), so the button is not there and one
   line says why; in the Android app, the button. The confirm sheet says the
   size, the areas, the build — and, when a pack is on the phone, that the new
   one REPLACES it completely, its photos with it. */
import { describe, expect, it, vi } from 'vitest';
import type { PlanView } from '../lib/map/build/builder.svelte';

const text = (html: string): string => html.replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const TRIP = { id: 'il26', title: 'TEST — Israel 60' };
/* the server renderer and the component from ONE module graph (a test resets it to mock the platform) */
const ssr = async () => (await import('svelte/server')).render;

describe('the build button', () => {
  it('in a browser: no button — one line says it needs the Android app', async () => {
    vi.resetModules();
    const { default: BuildMap } = await import('../lib/components/map/BuildMap.svelte');
    const render = await ssr();
    const { body } = render(BuildMap, { props: { trip: TRIP } });
    expect(text(body)).toContain('Building a map needs the LTD app on Android — in a browser, import a map pack file instead.');
    expect(body).not.toContain('Build map for this trip');
    expect(body).not.toMatch(/<button/);
  });

  it('in the Android app: the button, named for the trip', async () => {
    vi.resetModules();
    vi.doMock('../lib/platform/files', () => ({ isNative: () => true }));
    const { default: BuildMap } = await import('../lib/components/map/BuildMap.svelte');
    const render = await ssr();
    const { body } = render(BuildMap, { props: { trip: TRIP } });
    expect(text(body)).toContain('Build map for this trip');
    expect(body).toContain('aria-label="Build the map for TEST — Israel 60"');
    expect(body).not.toContain('needs the LTD app');
    /* no trip to build for: the button is there but cannot be pressed */
    const none = render(BuildMap, { props: { trip: null } }).body;
    expect(none).toMatch(/<button[^>]*disabled/);
    vi.doUnmock('../lib/platform/files');
  });

  it('in Settings the button names the trip; a paused build always names ITS trip, whatever trip is on screen (8 Nov)', async () => {
    vi.resetModules();
    vi.doMock('../lib/platform/files', () => ({ isNative: () => true }));
    const { default: BuildMap } = await import('../lib/components/map/BuildMap.svelte');
    const { mapBuilder } = await import('../lib/map/build/builder.svelte');
    const render = await ssr();
    expect(text(render(BuildMap, { props: { trip: TRIP, named: true } }).body)).toContain('Build the map for TEST — Israel 60');
    mapBuilder.phase = 'paused';
    mapBuilder.title = 'China 2026';
    mapBuilder.pct = 55;
    const t = text(render(BuildMap, { props: { trip: TRIP, named: true } }).body);
    expect(t).toContain('The map build for China 2026 stopped at 55 %');
    expect(t).not.toContain('Israel');
    mapBuilder.phase = 'idle';
    vi.doUnmock('../lib/platform/files');
  });
});

describe('the confirm sheet', () => {
  const view: PlanView = {
    title: 'TEST — Israel 60',
    bytes: 102_701_163,
    download: 107_286_739,
    areas: ['Tel Aviv + Jerusalem', 'Negev & Mitzpe Ramon', 'Eilat & the Red Sea', 'Dead Sea', 'Galilee & the Golan', 'Haifa & the coast'],
    date: '20261107',
    hadPack: true,
    photos: 12,
    carried: 0,
  };
  const sheet = async (v: PlanView): Promise<string> => {
    const { default: BuildConfirm } = await import('../lib/components/map/BuildConfirm.svelte');
    const render = await ssr();
    return text(render(BuildConfirm, { props: { view: v, onconfirm: () => {}, oncancel: () => {} } }).body);
  };

  it('says the real size first, the network, the areas and the build', async () => {
    const t = await sheet(view);
    expect(t).toContain('About 107.3 MB to download');
    expect(t).toContain('The finished map takes 102.7 MB on this phone.');
    expect(t).toContain('working this out read a few MB already');
    expect(t).toContain('On Wi-Fi or mobile data');
    expect(t).toContain('6 areas: Tel Aviv + Jerusalem · Negev &amp; Mitzpe Ramon · Eilat &amp; the Red Sea · Dead Sea · Galilee &amp; the Golan · Haifa &amp; the coast');
    expect(t).toContain('at least 25 km round it');
    expect(t).toContain('Protomaps build of 7 Nov 2026');
    expect(t).toMatch(/Not now .*Build it/);
    expect(t.indexOf('107.3 MB')).toBeLessThan(t.indexOf('102.7 MB'));
    expect(t.indexOf('102.7 MB')).toBeLessThan(t.indexOf('Build it'));
  });

  it('with a pack on the phone: it REPLACES it completely — photos that are not this trip’s go with it', async () => {
    const t = await sheet(view);
    expect(t).toContain('This REPLACES the map pack on this phone completely — its streets and its 12 place photos, which are another trip’s. The new map has no place photos.');
    const one = await sheet({ ...view, carried: 1, photos: 1 });
    expect(one).toContain('its streets; its place photo comes along into the new map.');
    const bare = await sheet({ ...view, photos: 0 });
    expect(bare).toContain('REPLACES the map pack on this phone completely — its streets. The new map has no place photos.');
  });

  it('when the photos are this trip’s, they come along — the sheet says so, and nothing about losing them (8 Nov)', async () => {
    const t = await sheet({ ...view, carried: 12 });
    expect(t).toContain('This REPLACES the map pack on this phone completely — its streets; its 12 place photos come along into the new map.');
    expect(t).not.toContain('has no place photos');
    const other = await sheet({ ...view, carried: 0 });
    expect(other).toContain('its 12 place photos, which are another trip’s. The new map has no place photos.');
  });

  it('with no pack on the phone: nothing to replace, so no warning — only that it has no photos', async () => {
    const t = await sheet({ ...view, hadPack: false, photos: 0 });
    expect(t).not.toContain('REPLACES');
    expect(t).toContain('The new map has no place photos.');
  });
});
