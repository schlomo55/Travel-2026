/* WHERE YOU ARE, AND WHICH WAY YOU FACE (Map 5c) — offline: GPS needs no
   network, and the compass is the phone's own sensor.

   ASKED FOR ONLY WHEN YOU ASK. The Map tab never prompts on its own: the first
   "Show where you are" tap starts the position watch, which is when Android
   asks (the WebView relays the page's request as ACCESS_COARSE/FINE_LOCATION,
   AndroidManifest.xml). Once you have said yes, the tab remembers you wanted
   it (a per-phone flag, `ltd:map:locate`) and starts it quietly next time —
   Android does not ask twice for a permission it holds. Denied, the tab says
   so once and works on without you: no dot, no distances, everything else.

   THE HEADING: `deviceorientationabsolute` — measured from magnetic north on
   Android (lib/logic/wayfind.ts headingFromOrientation turns it into a
   compass heading) — is listened to only while Guide me or the map needs it;
   the GPS course, when you walk, is the better heading (steerHeading).

   Nothing runs while the app is hidden: the watch is paused and resumed.

   A POSITION FROM BEFORE IS NOT YOU (Map 5d). Leaving the tab or hiding the
   app stops the watch but keeps the last fix; coming back, a fix older than
   STALE_MS is forgotten — no dot, no rings, no distances from it — and the
   state is 'asking' ("Finding where you are…") until the watch brings a new
   one. A fix the running watch hands over is current: that is what it is for.

   No position at all (location services off, no signal): 'unavailable' — and
   "Show where you are" then starts the watch over, rather than doing nothing
   because a watch is already running. */
import { headingFromOrientation, screenAngleOf, staleFix } from '../logic/wayfind';

export interface Fix {
  lat: number;
  lng: number;
  /** metres */
  accuracy: number;
  /** degrees from true north while moving, else null */
  course: number | null;
  /** metres per second, or null */
  speed: number | null;
  at: number;
}

export type LocateState = 'off' | 'asking' | 'on' | 'denied' | 'unavailable';

const WANT = 'ltd:map:locate';
const remember = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(WANT, '1');
    else localStorage.removeItem(WANT);
  } catch {
    /* no storage — it just asks again next time */
  }
};
const wanted = (): boolean => {
  try {
    return localStorage.getItem(WANT) === '1';
  } catch {
    return false;
  }
};

class Locator {
  state = $state<LocateState>('off');
  fix = $state<Fix | null>(null);
  /** the compass heading from the phone's sensors, MAGNETIC north, or null */
  compass = $state<number | null>(null);
  private watch: number | null = null;
  private users = 0;
  private headingUsers = 0;
  private paused = false;
  private onVis = (): void => this.visibility();
  private onOrient = (e: Event): void => {
    const o = e as DeviceOrientationEvent;
    /* the screen may be turned (landscape): its top edge is the pointer, not the phone's */
    const h = headingFromOrientation(o.alpha, o.beta, o.gamma, screenAngleOf(globalThis as Parameters<typeof screenAngleOf>[0]));
    if (h != null) this.compass = Math.round(h);
  };

  /** The Map tab opened: resume what you asked for before — never from a
      position left over from last time. */
  attach(): void {
    if (this.users++ === 0) {
      document.addEventListener('visibilitychange', this.onVis);
      this.forgetStale();
      if (wanted()) this.start();
    }
  }
  /** Back after a while: the last fix is where you were, not where you are.
      No position now — and 'asking' only once a watch is really started
      (`start`), never a "Finding…" with nothing looking. */
  private forgetStale(): void {
    if (!this.fix || !staleFix(this.fix.at, Date.now())) return;
    this.fix = null;
    if (this.state === 'on') this.state = 'off';
  }
  detach(): void {
    if (--this.users > 0) return;
    this.users = 0;
    document.removeEventListener('visibilitychange', this.onVis);
    this.clear();
    this.headingUsers = 0;
    window.removeEventListener('deviceorientationabsolute', this.onOrient);
    this.compass = null;
  }

  /** "Show where you are": start watching (Android asks the first time). With
      no position to be had, a watch still running is started over — the tap
      is someone turning location on and asking again. */
  start(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.state = 'unavailable';
      return;
    }
    if (this.watch !== null && this.state === 'unavailable') this.clear();
    if (this.watch !== null) return;
    if (this.state !== 'on') this.state = 'asking';
    this.watch = navigator.geolocation.watchPosition(
      (p) => {
        this.state = 'on';
        remember(true);
        const c = p.coords;
        this.fix = {
          lat: c.latitude,
          lng: c.longitude,
          accuracy: c.accuracy,
          course: c.heading != null && Number.isFinite(c.heading) ? c.heading : null,
          speed: c.speed != null && Number.isFinite(c.speed) ? c.speed : null,
          at: p.timestamp,
        };
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.state = 'denied';
          remember(false);
          this.fix = null;
          this.clear();
        } else if (!this.fix) this.state = 'unavailable';
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
  }
  /** Stop following for good (the switch turned off). */
  stop(): void {
    this.clear();
    remember(false);
    this.state = 'off';
    this.fix = null;
  }
  private clear(): void {
    if (this.watch !== null) navigator.geolocation.clearWatch(this.watch);
    this.watch = null;
  }

  /** The compass, for as long as someone reads it. */
  heading(on: boolean): void {
    if (on) {
      if (this.headingUsers++ === 0) window.addEventListener('deviceorientationabsolute', this.onOrient);
    } else if (this.headingUsers > 0 && --this.headingUsers === 0) {
      window.removeEventListener('deviceorientationabsolute', this.onOrient);
      this.compass = null;
    }
  }

  private visibility(): void {
    if (document.hidden) {
      if (this.watch !== null) {
        this.clear();
        this.paused = true;
      }
    } else if (this.paused) {
      this.paused = false;
      this.forgetStale();
      this.start();
    }
  }
}

export const locator = new Locator();
