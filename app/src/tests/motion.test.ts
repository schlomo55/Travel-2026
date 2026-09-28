/* THE MOTION STATE. Three switches that are not the same switch: Calm motion
   stills everything, Route animations stills only the routes, and a hidden
   app pauses all of it. The phone's own reduce-motion is honoured in CSS.
   And the clocks of the one-shots: Ink (remembered, paced) and Relay. */
import { describe, expect, it } from 'vitest';
import { inkDue, inkKey, inkPace, motionClasses, relayPlan, routeMotionState } from '../lib/logic/motion';

describe('motion · classes on <html>', () => {
  it('a fresh install moves: no class at all', () => {
    expect(motionClasses({})).toEqual([]);
    expect(motionClasses({ calmMotion: false, routeAnimations: true, hidden: false })).toEqual([]);
  });

  it('Route animations is ON unless it is explicitly false', () => {
    expect(motionClasses({ routeAnimations: undefined })).not.toContain('no-routes');
    expect(motionClasses({ routeAnimations: false })).toEqual(['no-routes']);
  });

  it('Calm motion stills everything — routes included', () => {
    expect(motionClasses({ calmMotion: true })).toEqual(['calm', 'no-routes']);
    expect(motionClasses({ calmMotion: true, routeAnimations: true })).toEqual(['calm', 'no-routes']);
  });

  it('a hidden app pauses, whatever the settings', () => {
    expect(motionClasses({ hidden: true })).toEqual(['app-hidden']);
    expect(motionClasses({ calmMotion: true, hidden: true })).toEqual(['calm', 'no-routes', 'app-hidden']);
  });
});

describe('motion · what the Settings row says', () => {
  it('on, off, or held by Calm motion', () => {
    expect(routeMotionState({})).toBe('on');
    expect(routeMotionState({ routeAnimations: false })).toBe('off');
    expect(routeMotionState({ calmMotion: true })).toBe('calm');
    /* off wins: it is the switch the row belongs to */
    expect(routeMotionState({ routeAnimations: false, calmMotion: true })).toBe('off');
  });
});


describe('motion · Ink remembers', () => {
  it('inks a key once, and a new day or a newly finished leg inks again', () => {
    const k = inkKey('cn26', '2026-12-11', 2);
    expect(inkDue(null, k)).toBe(true);
    expect(inkDue(k, k)).toBe(false);
    expect(inkDue(k, inkKey('cn26', '2026-12-12', 2))).toBe(true);
    expect(inkDue(k, inkKey('cn26', '2026-12-11', 3))).toBe(true);
  });

  it('paces the road so far at one speed: time by length, one leg after the other', () => {
    const p = inkPace([100, 300, 100], 2500);
    expect(p.map((s) => s.dur)).toEqual([500, 1500, 500]);
    expect(p.map((s) => s.delay)).toEqual([0, 500, 2000]);
    expect(inkPace([], 2500)).toEqual([]);
    expect(inkPace([0, 0], 2500).every((s) => s.dur === 0)).toBe(true);
  });
});

describe('motion · Relay sweeps once', () => {
  it('lights in order, pauses on amber and longer on red, and ends on a count', () => {
    const r = relayPlan(['ok', 'warn', 'ok', 'crit'], 100, { warn: 300, crit: 600 });
    expect(r.steps.map((s) => s.delay)).toEqual([0, 100, 500, 600]);
    expect(r.steps.map((s) => s.dur)).toEqual([100, 400, 100, 700]);
    expect(r.total).toBe(1300);
    expect(r.counts).toEqual({ ok: 2, warn: 1, crit: 1 });
  });
});
