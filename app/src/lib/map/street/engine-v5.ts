/* THE MAP ENGINE'S FALLBACK — maplibre-gl 5.24 (BSD-3-Clause, the spike's
   tested alternative): one UMD file whose worker is built from the same
   bundle as a blob: URL (the app has no CSP, so a blob worker is allowed).
   Chosen at build time with `vite build --mode engine-v5` (vite.config.ts
   points `#map-engine` here); the default is engine-v6.ts. Its API is the
   one the glue uses from v6. */
import maplibregl from 'maplibre-gl-v5';

export default maplibregl as unknown as typeof import('maplibre-gl');
