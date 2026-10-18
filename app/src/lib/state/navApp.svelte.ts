/* WHICH APP TURN-BY-TURN OPENS IN (demo) — the traveller's choice, kept in
   Settings.navApp and handed here by App.svelte, the way Calm motion reaches
   `motion`. Read by Guide me and by the Directions on a day's legs.
     'auto'   — Amap on the mainland, Google Maps in Hong Kong, Macau and
                abroad (geo.ts guideApp: Amap has no entry for many Hong Kong
                landmarks; Google needs a VPN on the mainland)
     'amap'   — always Amap
     'google' — always Google Maps */
import { guideApp, type MapTarget } from '../logic/geo';

export type NavPref = 'auto' | 'amap' | 'google';
export const NAV_PREFS: readonly NavPref[] = ['auto', 'amap', 'google'];

/** The app a target's turn-by-turn opens in, under a preference. */
export function navAppFor(t: MapTarget, pref: NavPref): 'amap' | 'google' {
  return pref === 'auto' ? guideApp(t) : pref;
}

class NavApp {
  pref = $state<NavPref>('auto');

  for(t: MapTarget): 'amap' | 'google' {
    return navAppFor(t, this.pref);
  }
}

export const navApp = new NavApp();
