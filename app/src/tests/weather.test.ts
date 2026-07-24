import { describe, expect, it } from 'vitest';
import {
  asWeatherCache,
  dayIn,
  forecastUrl,
  isSnowCode,
  isStale,
  parseForecast,
  STALE_AFTER_MS,
  weatherChip,
  weatherIcon,
  weatherKey,
  type DailyWeather,
} from '../lib/logic/weather';

const day = (over: Partial<DailyWeather> = {}): DailyWeather => ({
  date: '2026-12-10',
  code: 71,
  tmin: -5,
  tmax: -1,
  snow: 3,
  pp: 80,
  ...over,
});

describe('WMO code map', () => {
  it('follows the locked table', () => {
    expect([0, 1].map(weatherIcon)).toEqual(['☀', '☀']);
    expect([2, 3].map(weatherIcon)).toEqual(['⛅', '⛅']);
    expect([45, 48].map(weatherIcon)).toEqual(['🌫', '🌫']);
    expect([51, 61, 67].map(weatherIcon)).toEqual(['🌧', '🌧', '🌧']);
    expect([71, 75, 77, 85, 86].map(weatherIcon)).toEqual(['❄', '❄', '❄', '❄', '❄']);
    expect([80, 81, 82].map(weatherIcon)).toEqual(['🌧', '🌧', '🌧']);
    expect([95, 96, 99].map(weatherIcon)).toEqual(['⛈', '⛈', '⛈']);
  });

  it('knows which codes mean snow — the gate for the animation', () => {
    expect([71, 73, 75, 77, 85, 86].every(isSnowCode)).toBe(true);
    expect([0, 3, 48, 61, 80, 95].some(isSnowCode)).toBe(false);
  });
});

describe('the chip', () => {
  it('reads as a temperature range with a real minus sign', () => {
    expect(weatherChip(day())).toBe('❄ −5°…−1°');
    expect(weatherChip(day({ code: 0, tmin: 3.4, tmax: 11.6 }))).toBe('☀ 3°…12°');
  });
});

describe('parseForecast', () => {
  it('turns Open-Meteo column arrays into rows', () => {
    const rows = parseForecast({
      daily: {
        time: ['2026-12-10', '2026-12-11'],
        weather_code: [71, 3],
        temperature_2m_max: [-1, 4],
        temperature_2m_min: [-5, 0],
        snowfall_sum: [3.2, 0],
        precipitation_probability_max: [80, 10],
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: '2026-12-10', code: 71, tmax: -1, tmin: -5, snow: 3.2, pp: 80 });
  });

  it('never throws on rubbish — a blocked request must look like being offline', () => {
    expect(parseForecast(null)).toEqual([]);
    expect(parseForecast({})).toEqual([]);
    expect(parseForecast({ daily: { time: 'nope' } })).toEqual([]);
    expect(parseForecast('<html>blocked</html>')).toEqual([]);
  });

  it('fills missing columns with zeros rather than dropping the day', () => {
    const rows = parseForecast({ daily: { time: ['2026-12-10'], weather_code: [0] } });
    expect(rows[0]).toEqual({ date: '2026-12-10', code: 0, tmax: 0, tmin: 0, snow: 0, pp: 0 });
  });
});

describe('the request', () => {
  it('sends coordinates and nothing else identifying', () => {
    const url = new URL(forecastUrl({ lat: 39.9033, lng: 116.3917 }));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect([...url.searchParams.keys()].sort()).toEqual([
      'daily',
      'forecast_days',
      'latitude',
      'longitude',
      'timezone',
    ]);
    expect(url.searchParams.get('latitude')).toBe('39.9033');
    expect(url.searchParams.get('forecast_days')).toBe('16');
  });
});

describe('the cache', () => {
  it('keys per stop', () => {
    expect(weatherKey('cn26-stop-beijing')).toBe('weather:v1:cn26-stop-beijing');
  });

  it('goes stale after six hours', () => {
    const now = 1_000_000_000;
    expect(isStale(null, now)).toBe(true);
    expect(isStale({ fetchedAt: now - STALE_AFTER_MS + 1000, daily: [] }, now)).toBe(false);
    expect(isStale({ fetchedAt: now - STALE_AFTER_MS - 1000, daily: [] }, now)).toBe(true);
  });

  it('survives a JSON round trip and rejects anything else', () => {
    const cache = { fetchedAt: 1, daily: [day()] };
    expect(asWeatherCache(JSON.parse(JSON.stringify(cache)))).toEqual(cache);
    expect(asWeatherCache(undefined)).toBeNull();
    expect(asWeatherCache({ fetchedAt: 'soon' })).toBeNull();
    expect(asWeatherCache({ daily: [] })).toBeNull();
  });

  it('finds a date, or nothing at all', () => {
    const cache = { fetchedAt: 1, daily: [day()] };
    expect(dayIn(cache, '2026-12-10')?.code).toBe(71);
    expect(dayIn(cache, '2026-12-11')).toBeNull();
    expect(dayIn(null, '2026-12-10')).toBeNull();
  });
});
