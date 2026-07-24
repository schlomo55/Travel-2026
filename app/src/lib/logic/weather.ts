/* Weather — the app's ONLY runtime network call, and it is optional.

   Rules that must never be broken (docs/ARCHITECTURE.md §1, the offline vow):
   - Only coordinates leave the device, only to Open-Meteo, only when the phone
     is online AND the setting is on.
   - Every path fails silently. The Great Firewall may simply eat the request;
     that must look exactly like being offline: nothing renders, nothing warns.
   - The cache lives in db.meta (a plain KV row) so no Dexie version bump is
     needed. Only plain JSON goes in.

   Open-Meteo is keyless and accountless — no identity is attached to the call. */
import type { Coord } from '../model/types';

export interface DailyWeather {
  date: string; // ISODate
  code: number; // WMO weather code
  tmin: number;
  tmax: number;
  snow: number; // cm
  pp: number; // precipitation probability, %
}

export interface WeatherCache {
  fetchedAt: number;
  daily: DailyWeather[];
}

export const WEATHER_KEY_PREFIX = 'weather:v1:';
export const weatherKey = (stopKey: string): string => `${WEATHER_KEY_PREFIX}${stopKey}`;

/** 16 days is Open-Meteo's free horizon. */
export const FORECAST_DAYS = 16;
export const FETCH_TIMEOUT_MS = 8000;
/** Re-fetch at most this often — the trip is 37 days, not a weather station. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
/** Older than this and the chip says where the number came from. */
export const NOTE_AGE_MS = 12 * 60 * 60 * 1000;

export function forecastUrl(c: Coord): string {
  const p = new URLSearchParams({
    latitude: c.lat.toFixed(4),
    longitude: c.lng.toFixed(4),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

interface OpenMeteoDaily {
  time?: unknown;
  weather_code?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  snowfall_sum?: unknown;
  precipitation_probability_max?: unknown;
}

const numAt = (a: unknown, i: number): number => {
  const v = Array.isArray(a) ? a[i] : null;
  return typeof v === 'number' && isFinite(v) ? v : 0;
};

/** Open-Meteo's column arrays → our row objects. Tolerates missing columns. */
export function parseForecast(json: unknown): DailyWeather[] {
  const daily = (json as { daily?: OpenMeteoDaily } | null)?.daily;
  const time = daily?.time;
  if (!daily || !Array.isArray(time)) return [];
  const out: DailyWeather[] = [];
  for (let i = 0; i < time.length; i++) {
    const date = time[i];
    if (typeof date !== 'string') continue;
    out.push({
      date,
      code: numAt(daily.weather_code, i),
      tmax: numAt(daily.temperature_2m_max, i),
      tmin: numAt(daily.temperature_2m_min, i),
      snow: numAt(daily.snowfall_sum, i),
      pp: numAt(daily.precipitation_probability_max, i),
    });
  }
  return out;
}

/** WMO code → one glyph. Deliberately coarse: this is a chip, not a forecast. */
export function weatherIcon(code: number): string {
  if (code <= 1) return '☀';
  if (code <= 3) return '⛅';
  if (code === 45 || code === 48) return '🌫';
  if (code >= 51 && code <= 67) return '🌧';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄';
  if (code >= 80 && code <= 82) return '🌧';
  if (code >= 95) return '⛈';
  return '⛅';
}

/** Snow codes: 71–77 (snowfall/grains) and 85–86 (snow showers). */
export function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

const round = (n: number): number => Math.round(n);

/** '❄ −5°…−1°' — an em-minus, because a hyphen reads as a dash at 11px. */
export function weatherChip(d: DailyWeather): string {
  const t = (n: number): string => `${round(n) < 0 ? '−' : ''}${Math.abs(round(n))}°`;
  return `${weatherIcon(d.code)} ${t(d.tmin)}…${t(d.tmax)}`;
}

export function isStale(cache: WeatherCache | null | undefined, now: number): boolean {
  return !cache || now - cache.fetchedAt > STALE_AFTER_MS;
}

export function dayIn(cache: WeatherCache | null | undefined, date: string): DailyWeather | null {
  return cache?.daily.find((d) => d.date === date) ?? null;
}

/** A WeatherCache that survived JSON, or null. Never throws. */
export function asWeatherCache(v: unknown): WeatherCache | null {
  const c = v as WeatherCache | null;
  if (!c || typeof c !== 'object') return null;
  if (typeof c.fetchedAt !== 'number' || !Array.isArray(c.daily)) return null;
  return c;
}
