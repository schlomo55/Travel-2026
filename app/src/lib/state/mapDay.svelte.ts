/* Which day's route the Map tab draws (demo). The Day view sets it before
   following its "See the day on the map" link; the Map tab's day chips set it
   too. Session-only.
     null  — today's day (appState.now), the default
     'all' — every day of the stay that has a route, one colour each
     'off' — no route drawn
     a date — that day */
import type { ISODate } from '../model/types';

class MapDay {
  sel = $state<ISODate | 'all' | 'off' | null>(null);
}

export const mapDay = new MapDay();
