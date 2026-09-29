/* THE MAP ENGINE — maplibre-gl 6.11 (BSD-3-Clause), native ESM: a main module
   and a worker module that share code. v6 finds its worker through a URL it
   builds at run time, which Vite cannot follow, so the worker is bundled here
   with `?worker&url` and handed to setWorkerUrl(): one file of the app's own,
   loaded from the app, never from the network (the spike's measurement: 305 KB
   gzipped here + 143 KB in the worker — scripts/check-bundle.mjs gates both,
   as the map engine, on their own budget).

   The TESTED FALLBACK is maplibre-gl 5.24 (engine-v5.ts): if v6's module
   worker will not start in the phone's WebView, build with
   `vite build --mode engine-v5` — vite.config.ts points `#map-engine` at it. */
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;
