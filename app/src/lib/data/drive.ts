/* Google Drive backup — the half that touches things.
 *
 * WHAT THIS IS FOR: a phone lost, stolen or drowned in Chongqing must cost a
 * device, not the trip. Everything else in this app is deliberately local; the
 * one thing local storage cannot survive is the phone not existing any more.
 *
 * WHAT LEAVES THE PHONE: exactly the bytes the Backup screen already writes to
 * Downloads — the `livingthedream/backup` envelope, gzipped — and nothing
 * else. No analytics, no identifiers, no telemetry, no "which screens did you
 * open". The scope is drive.appdata, so the app can see only the files it
 * wrote itself: not the owner's Drive, not their photos, not a file picker.
 *
 * WHEN: only after the owner opts in, and only while online. Offline is the
 * normal condition of this trip, so an offline auto-backup is a no-op — never
 * a spinner, never an error, never a nag. `lastBackupAt` tells the truth and
 * that is the whole reporting mechanism.
 *
 * TOKENS live in db.meta. Dexie's meta table is not part of the export
 * envelope (lib/data/export.ts builds from db.trips + the per-trip tables +
 * settings), so a backup file can never carry the credentials that wrote it —
 * asserted in src/tests/drive.test.ts.
 *
 * AUTH REALITY: Google refuses OAuth inside a WebView, so the APK cannot show
 * the consent screen itself. It hands the URL to the system browser and gets
 * the answer back through a custom-scheme redirect (PKCE, no secret). The PWA
 * has no such problem and uses Google Identity Services. Neither path exists
 * at all until docs/DRIVE-SETUP.md has been followed — see driveConfig.ts.
 */
import { db } from '../db/db';
import { isNative } from '../platform/files';
import { buildBackup } from './export';
import { gzipText } from '../logic/backup';
import {
  DRIVE_KEEP,
  DRIVE_SCOPE,
  EMPTY_STATUS,
  authUrl,
  challengeFor,
  driveErrorText,
  driveFileName,
  driveState,
  expiresAtFrom,
  mayReachDrive,
  multipartBody,
  parseRedirect,
  randomVerifier,
  shouldAutoBackup,
  sortVersions,
  toPrune,
  tokenExpired,
  type DriveFile,
  type DriveState,
  type DriveStatus,
  type DriveTokens,
} from '../logic/drive';
import { DRIVE_CONFIG, driveClientId, driveConfigured, driveRedirectUri } from './driveConfig';

const TOKENS_KEY = 'drive.tokens';
const STATUS_KEY = 'drive.status';
/** The PKCE verifier, parked while the system browser has the screen. The app
    may be evicted from memory entirely while the owner types a password. */
const PENDING_KEY = 'drive.pending';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const FIELDS = 'id,name,createdTime,size';

interface Pending {
  verifier: string;
  state: string;
  startedAt: number;
}

/* ---------- stored state ---------- */

async function readMeta<T>(key: string): Promise<T | null> {
  try {
    const row = await db.meta.get(key);
    return (row?.value as T | undefined) ?? null;
  } catch {
    return null;
  }
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function readTokens(): Promise<DriveTokens | null> {
  return readMeta<DriveTokens>(TOKENS_KEY);
}

export async function readStatus(): Promise<DriveStatus> {
  return (await readMeta<DriveStatus>(STATUS_KEY)) ?? EMPTY_STATUS;
}

async function patchStatus(patch: Partial<DriveStatus>): Promise<void> {
  await writeMeta(STATUS_KEY, { ...(await readStatus()), ...patch });
}

export async function currentDriveState(): Promise<DriveState> {
  return driveState({ configured: driveConfigured(isNative()), tokens: await readTokens() });
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/* ---------- tokens ---------- */

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function postForm(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) throw new Error(json.error_description ?? json.error ?? `Google said ${res.status}`);
  return json;
}

async function storeTokenResponse(json: TokenResponse, keepRefresh: string | null): Promise<DriveTokens> {
  if (!json.access_token) throw new Error('Google returned no access token');
  const now = Date.now();
  const prev = await readTokens();
  const tokens: DriveTokens = {
    accessToken: json.access_token,
    /* A refresh grant does not re-issue the refresh token — keep the one that
       earned it, or the second hour would silently become a re-login. */
    refreshToken: json.refresh_token ?? keepRefresh,
    expiresAt: expiresAtFrom(json.expires_in ?? 3600, now),
    connectedAt: prev?.connectedAt ?? now,
  };
  await writeMeta(TOKENS_KEY, tokens);
  return tokens;
}

async function refresh(tokens: DriveTokens): Promise<DriveTokens> {
  const clientId = driveClientId(isNative());
  if (!clientId || !tokens.refreshToken) throw new Error('Drive needs to be connected again');
  const json = await postForm(TOKEN_URL, {
    client_id: clientId,
    refresh_token: tokens.refreshToken,
    grant_type: 'refresh_token',
  });
  return storeTokenResponse(json, tokens.refreshToken);
}

/** A usable access token, or a throw the caller turns into one quiet line. */
async function accessToken(): Promise<string> {
  const tokens = await readTokens();
  if (!tokens) throw new Error('Drive is not connected');
  if (!tokenExpired(tokens, Date.now())) return tokens.accessToken;
  return (await refresh(tokens)).accessToken;
}

/* ---------- connect ---------- */

/**
 * Native: hand the consent screen to the system browser.
 *
 * Google blocks OAuth in WebViews (error `disallowed_useragent`), which is
 * exactly what a Capacitor app is, so this is not a preference. The verifier
 * is parked in Dexie first because the app may be killed while the browser is
 * in front; the answer arrives later through `handleOAuthRedirect`.
 */
async function connectNative(): Promise<void> {
  const clientId = driveClientId(true);
  if (!clientId) throw new Error('Drive is not set up yet');
  const verifier = randomVerifier();
  const state = randomVerifier().slice(0, 24);
  await writeMeta(PENDING_KEY, { verifier, state, startedAt: Date.now() } satisfies Pending);
  const url = authUrl({
    clientId,
    redirectUri: driveRedirectUri(),
    challenge: await challengeFor(verifier),
    state,
  });
  const { AppLauncher } = await import('@capacitor/app-launcher');
  await AppLauncher.openUrl({ url });
}

/**
 * The other half of the native flow. Called with the full redirect URL by
 * whichever native bridge delivered it (see docs/DRIVE-SETUP.md §native
 * wiring) — the app exposes it on `window` as well so a bridge that can only
 * evaluate a string of JavaScript can reach it.
 */
export async function handleOAuthRedirect(url: string): Promise<boolean> {
  const pending = await readMeta<Pending>(PENDING_KEY);
  const result = parseRedirect(url, pending?.state ?? null);
  if ('error' in result) {
    await patchStatus({ lastError: `Sign-in did not complete (${result.error})`, lastErrorAt: Date.now() });
    return false;
  }
  const clientId = driveClientId(true);
  if (!clientId || !pending) return false;
  try {
    const json = await postForm(TOKEN_URL, {
      client_id: clientId,
      code: result.code,
      code_verifier: pending.verifier,
      grant_type: 'authorization_code',
      redirect_uri: driveRedirectUri(),
    });
    await storeTokenResponse(json, null);
    await db.meta.delete(PENDING_KEY);
    await patchStatus({ lastError: null, lastErrorAt: null });
    return true;
  } catch (err) {
    await patchStatus({ lastError: driveErrorText(err), lastErrorAt: Date.now() });
    return false;
  }
}

/* Google Identity Services, typed to the two calls this app makes. */
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
interface GisResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface GisGlobal {
  accounts?: {
    oauth2?: {
      initTokenClient: (o: {
        client_id: string;
        scope: string;
        callback: (r: GisResponse) => void;
        error_callback?: (e: unknown) => void;
      }) => TokenClient;
    };
  };
}

function gis(): GisGlobal | undefined {
  return (globalThis as { google?: GisGlobal }).google;
}

/** Loaded ONLY when the owner taps Connect on the web, never at startup: an
    unconnected install must not fetch a Google script to sit on a screen. */
async function loadGis(): Promise<void> {
  if (gis()?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
  if (!gis()?.accounts?.oauth2) throw new Error('Could not load Google sign-in');
}

async function connectWeb(): Promise<void> {
  const clientId = driveClientId(false);
  if (!clientId) throw new Error('Drive is not set up yet');
  await loadGis();
  const oauth2 = gis()?.accounts?.oauth2;
  if (!oauth2) throw new Error('Could not load Google sign-in');
  await new Promise<void>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (r: GisResponse) => {
        if (r.error || !r.access_token) {
          reject(new Error(r.error ?? 'Sign-in was cancelled'));
          return;
        }
        /* No refresh token on this path by design — GIS issues access tokens
           only. An hour later the web asks again, which on a laptop is fine. */
        void storeTokenResponse({ access_token: r.access_token, expires_in: r.expires_in }, null).then(
          () => resolve(),
          reject,
        );
      },
      error_callback: (e: unknown) => reject(new Error(driveErrorText(e))),
    });
    client.requestAccessToken();
  });
}

export async function connectDrive(): Promise<void> {
  if (!driveConfigured(isNative())) throw new Error('Drive is not set up yet');
  if (isNative()) await connectNative();
  else await connectWeb();
}

/** Opting out has to be as complete as opting in: tokens gone from the phone
    AND the grant withdrawn at Google, so nothing is left holding access. */
export async function disconnectDrive(): Promise<void> {
  const tokens = await readTokens();
  if (tokens && online()) {
    try {
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: tokens.refreshToken ?? tokens.accessToken }).toString(),
      });
    } catch {
      /* The phone forgets regardless — a revoke that could not be delivered
         must not leave the tokens sitting here. */
    }
  }
  await db.meta.delete(TOKENS_KEY);
  await db.meta.delete(PENDING_KEY);
  await patchStatus({ lastError: null, lastErrorAt: null });
}

/* ---------- the backup itself ---------- */

async function vaultBlob(): Promise<Blob> {
  const ids = (await db.trips.toArray()).map((t) => t.id);
  return gzipText(JSON.stringify(await buildBackup(ids, true)));
}

async function listRaw(token: string): Promise<DriveFile[]> {
  const q = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: `files(${FIELDS})`,
    pageSize: '100',
    orderBy: 'createdTime desc',
  });
  const res = await fetch(`${FILES_URL}?${q.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive listing failed (${res.status})`);
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files ?? [];
}

/** The versions on offer, newest first. Used by the restore list. */
export async function listDriveVersions(): Promise<DriveFile[]> {
  if (!mayReachDrive({ state: await currentDriveState(), online: online() })) return [];
  return sortVersions(await listRaw(await accessToken()));
}

async function prune(token: string): Promise<void> {
  const doomed = toPrune(await listRaw(token), DRIVE_KEEP);
  for (const f of doomed) {
    try {
      await fetch(`${FILES_URL}/${encodeURIComponent(f.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* A version that would not delete is not a failed backup. */
    }
  }
}

/**
 * Upload one version. Returns false for every "not now" — not connected, not
 * online, not set up — WITHOUT touching the network or writing an error,
 * because none of those are failures.
 */
export async function backupToDrive(): Promise<boolean> {
  const state = await currentDriveState();
  if (!mayReachDrive({ state, online: online() })) return false;
  try {
    const token = await accessToken();
    const name = driveFileName(new Date());
    const body = multipartBody(
      `ltd${Date.now().toString(36)}`,
      { name, parents: ['appDataFolder'], mimeType: 'application/gzip' },
      'application/gzip',
      await vaultBlob(),
    );
    const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=${FIELDS}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': body.type,
      },
      body,
    });
    if (!res.ok) throw new Error(`Drive refused the upload (${res.status})`);
    await patchStatus({ lastBackupAt: Date.now(), lastFileName: name, lastError: null, lastErrorAt: null });
    /* The local "last backup" stamp is what silences the stale-backup nag, and
       a copy in Drive is a copy — it counts. Written straight to Dexie rather
       than through repo.ts: repo owns the mutation hook that calls back into
       this module, and a backup must not be able to schedule another one. */
    const cur = await db.settings.get('settings');
    if (cur) await db.settings.put({ ...cur, lastBackupAt: Date.now() });
    await prune(token);
    return true;
  } catch (err) {
    await patchStatus({ lastError: driveErrorText(err), lastErrorAt: Date.now() });
    return false;
  }
}

/** Pull one version back down. The bytes go to the EXISTING staged-preview
    import flow — a restore is never applied blind. */
export async function downloadDriveVersion(f: DriveFile): Promise<File> {
  const token = await accessToken();
  const res = await fetch(`${FILES_URL}/${encodeURIComponent(f.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not download that version (${res.status})`);
  return new File([await res.blob()], f.name, { type: 'application/gzip' });
}

/* ---------- auto-backup ---------- */

/** Long enough that a burst of edits is one upload, short enough that putting
    the phone down means it is already safe. */
const DEBOUNCE_MS = 20_000;
/** …and never more often than this, however busy the traveller is. */
const MIN_GAP_MS = 5 * 60_000;

let timer: ReturnType<typeof setTimeout> | null = null;

async function autoRun(): Promise<void> {
  timer = null;
  const [state, status, settings] = await Promise.all([
    currentDriveState(),
    readStatus(),
    db.settings.get('settings'),
  ]);
  if (
    !shouldAutoBackup({
      state,
      online: online(),
      lastBackupAt: status.lastBackupAt,
      lastMutationAt: settings?.lastMutationAt ?? 0,
      now: Date.now(),
      minGapMs: MIN_GAP_MS,
    })
  ) {
    return;
  }
  await backupToDrive();
}

/**
 * Called after every user-visible mutation (repo.ts → touchMutation).
 *
 * The first line is load-bearing: with no client id there is no timer, no
 * Dexie read and no possibility of a request — the rehearsal's "zero network
 * calls" holds structurally, not by luck.
 */
export function noteMutation(): void {
  if (!driveConfigured(isNative())) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void autoRun(), DEBOUNCE_MS);
}

/**
 * Wired in main.ts so the OAuth answer can get back in.
 *
 * Two doors, because the APK's native side is the owner's to finish (see
 * docs/DRIVE-SETUP.md §5):
 *
 * 1. `window.__ltdOAuthRedirect(url)` — anything that can evaluate a string of
 *    JavaScript in the WebView can deliver the redirect, including four lines
 *    of Java in MainActivity;
 * 2. Capacitor's App plugin, if it is installed. It is reached through the
 *    global plugin proxy rather than an import on purpose: `@capacitor/app` is
 *    not a dependency of this build, and a static import of a package that is
 *    not there does not compile. Adding the plugin later needs no code change.
 */
export function exposeOAuthBridge(): void {
  (globalThis as { __ltdOAuthRedirect?: (url: string) => void }).__ltdOAuthRedirect = (url: string) => {
    void handleOAuthRedirect(url);
  };
  interface AppPlugin {
    addListener?: (event: string, cb: (data: { url?: string }) => void) => unknown;
  }
  const plugins = (globalThis as { Capacitor?: { Plugins?: Record<string, AppPlugin | undefined> } }).Capacitor
    ?.Plugins;
  try {
    plugins?.App?.addListener?.('appUrlOpen', (data: { url?: string }) => {
      if (data.url && data.url.startsWith(`${DRIVE_CONFIG.redirectScheme}:`)) void handleOAuthRedirect(data.url);
    });
  } catch {
    /* No App plugin on this build — door 1 still works. */
  }
}
