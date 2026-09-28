/* THE MOTION STATE. Three switches that are not the same switch: Calm motion
   stills everything, Route animations stills only the routes, and a hidden
   app pauses all of it. The phone's own reduce-motion is honoured in CSS. */
import { describe, expect, it } from 'vitest';
import { motionClasses, routeMotionState } from '../lib/logic/motion';

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
