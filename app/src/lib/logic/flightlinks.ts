/* "CHECK LIVE STATUS" — no flight-data service, by the owner's decision
   (29 Sep 2026): the button opens the flight's own public page. FlightAware
   first (times, delay, often the gate), Flightradar24 second (the plane on
   a map). Inside mainland China both may be blocked; the app then says to
   use the Variflight (飞常准) app, which is Chinese, has English, and knows
   domestic gates best.

   FlightAware files a flight under the airline's ICAO code (CCA8641, not
   CA8641); Flightradar24 under the IATA code, lower-case (ca8641). The
   table covers every airline this app has carried; an airline it does not
   know goes to FlightAware under its IATA code, which FlightAware's own
   search also answers. */

const ICAO: Record<string, string> = {
  CA: 'CCA', // Air China
  MU: 'CES', // China Eastern
  CZ: 'CSN', // China Southern
  '3U': 'CSC', // Sichuan Airlines
  HU: 'CHH', // Hainan Airlines
  ZH: 'CSZ', // Shenzhen Airlines
  MF: 'CXA', // Xiamen Airlines
  FM: 'CSH', // Shanghai Airlines
  SC: 'CDG', // Shandong Airlines
  HO: 'DKH', // Juneyao
  EY: 'ETD', // Etihad
  CX: 'CPA', // Cathay Pacific
  HX: 'CRK', // Hong Kong Airlines
  UO: 'HKE', // HK Express
  NX: 'AMU', // Air Macau
  LY: 'ELY', // El Al
  EK: 'UAE', // Emirates
  QR: 'QTR', // Qatar
  TK: 'THY', // Turkish
};

/** "CA 8641" → { airline: 'CA', number: '8641' }, or null. */
export function splitFlightNo(flightNo: string): { airline: string; number: string } | null {
  const m = /^\s*([A-Z0-9]{2})\s*(\d{1,4}[A-Z]?)\s*$/i.exec(flightNo);
  if (!m) return null;
  return { airline: m[1]!.toUpperCase(), number: m[2]!.toUpperCase() };
}

export function flightAwareUrl(flightNo: string): string | null {
  const f = splitFlightNo(flightNo);
  if (!f) return null;
  return `https://flightaware.com/live/flight/${ICAO[f.airline] ?? f.airline}${f.number}`;
}

export function flightradarUrl(flightNo: string): string | null {
  const f = splitFlightNo(flightNo);
  if (!f) return null;
  return `https://www.flightradar24.com/data/flights/${f.airline.toLowerCase()}${f.number.toLowerCase()}`;
}
