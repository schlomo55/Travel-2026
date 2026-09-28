/* The day as Now decides it once (routes/Now.svelte) and hands it to the
   screen that draws it — types only. */
import type { Booking, HotelBooking, ISODate, Runbook, Stop, Trip } from '../../model/types';
import type { Commitment } from '../../logic/commitment';
import type { TonightFact } from '../../logic/concierge';
import type { ResolvedDay } from '../../logic/day';
import type { MetroLine, StepProgress } from '../../logic/metroline';
import type { TripPhase } from '../../logic/phase';
import type { TodoPlan } from '../../logic/todo';
import type { DailyWeather, WeatherCache } from '../../logic/weather';

export interface NowCtx {
  trip: Trip;
  now: ISODate;
  phase: TripPhase;
  stop: Stop | null;
  day: ResolvedDay | null;
  runbook?: Runbook;
  ticked: (i: number) => boolean;
  progress: StepProgress;
  /** the travel day's metro line — null on any other day */
  line: MetroLine | null;
  /** "Day 21 of 37" */
  dayTag: string;
  /** the stay that covers tonight */
  bed?: HotelBooking;
  /** the overnight leg tonight is spent aboard */
  aboard: Booking | null;
  tonight: TonightFact | null;
  next: Commitment | null;
  plan: TodoPlan;
  weather: WeatherCache | null;
  /** today's forecast, from the cache */
  today: DailyWeather | null;
  /** minutes past midnight on the real today, else null */
  clock: number | null;
  realToday: ISODate;
}
