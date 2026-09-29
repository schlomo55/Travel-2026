/* The one call scripts/maps/declination.ts makes into the magvar package
   (WMM2025, MIT) — it ships plain JavaScript without types. */
declare module 'magvar' {
  /** Declination in degrees, east positive, at a WGS-84 point; altitude in km;
      `when` a decimal year or a Date. */
  export function magvar(latitude: number, longitude: number, altitudeKm?: number, when?: number | Date): number;
}
