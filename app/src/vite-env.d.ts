/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** The Protomaps API key, built in only by `vite build --mode android` and the dev server
    (vite.config.ts, from ~/.ltd-private/protomaps.key); '' or undefined everywhere else. */
declare const __LTD_MAP_KEY__: string | undefined;
