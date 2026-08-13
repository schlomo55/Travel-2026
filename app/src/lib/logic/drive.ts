/* Google Drive backup — the pure half.
 *
 * Everything here is a function of its arguments: the PKCE dance, token
 * expiry, the filename, which versions to prune, and the one question the
 * whole feature turns on — "may I touch the network right now?".
 *
 * It is separated from lib/data/drive.ts (which owns fetch and Dexie) for one
 * reason: this is the part that can be proved without a Google account. The
 * owner's client id does not exist yet and the real login is a step only they
 * can take on the phone, so the tests have to carry the weight instead.
 *
 * §RULES: offline is sacred. The app makes exactly two kinds of runtime
 * request — weather, and this. `mayReachDrive` is the gate, and it answers
 * false for every state except "the owner opted in AND the phone is online".
 */

/** The app-private folder. Google shows the app NOTHING else in the Drive:
    not the owner's documents, not their photos, not even the folder's name in
    a file picker. This is the whole privacy story, and the UI says it. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** How many backups survive in the appdata folder. Older ones are deleted
    after each successful upload — a phone lost in week three should still be
    able to reach back past the mistake made in week two. */
export const DRIVE_KEEP = 10;

/** Treat a token as dead a minute early: a request that starts valid and
    lands expired is an error the traveller would have to understand. */
export const EXPIRY_SKEW_MS = 60_000;

export const DRIVE_HOSTS = ['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com'] as const;

export interface DriveTokens {
  accessToken: string;
  /** Only the installed-app (PKCE) flow issues one. The PWA's Google Identity
      Services token client hands out an access token and nothing else, so on
      the web this is null and re-consent is a tap, not a bug. */
  refreshToken: string | null;
  expiresAt: number;
  connectedAt: number;
}

export interface DriveStatus {
  lastBackupAt: number | null;
  lastFileName: string | null;
  /** Surfaced ONCE, quietly, in the Backup screen's state line. The same
      philosophy as weather: "last successful backup" is the honest number,
      and a failure never becomes a nag. */
  lastError: string | null;
  lastErrorAt: number | null;
}

export const EMPTY_STATUS: DriveStatus = {
  lastBackupAt: null,
  lastFileName: null,
  lastError: null,
  lastErrorAt: null,
};

/** A file as the app cares about it — Drive returns more; this is the part
    the restore list draws. */
export interface DriveFile {
  id: string;
  name: string;
  createdTime?: string;
  size?: number;
}

/* ---------- PKCE (RFC 7636) ---------- */

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Map random bytes onto the unreserved set. Modulo bias is irrelevant at
    this alphabet size against 64 bytes of entropy, and staying inside the
    unreserved set means the verifier never needs escaping anywhere. */
export function verifierFrom(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += UNRESERVED[b % UNRESERVED.length];
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** 64 chars — inside RFC 7636's 43..128 window with room to spare. */
export function randomVerifier(): string {
  return verifierFrom(randomBytes(64));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export interface AuthUrlParams {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
}

export function authUrl(p: AuthUrlParams): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    state: p.state,
    /* offline + consent is what makes Google issue a refresh token, which is
       what makes the phone able to back up in week four without the owner
       signing in again in a country where signing in is hard. */
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export type RedirectResult = { code: string } | { error: string };

/**
 * Read the code out of `com.livingthedream.travel:/oauth2redirect?code=…`.
 *
 * Parsed by hand rather than through `new URL()`: a custom scheme with a
 * single slash is not a URL every engine agrees about, and this has to behave
 * identically in a WebView, a browser and a unit test.
 */
export function parseRedirect(url: string, expectedState: string | null): RedirectResult {
  const q = url.indexOf('?');
  const params = new URLSearchParams(q >= 0 ? url.slice(q + 1) : '');
  const err = params.get('error');
  if (err) return { error: err };
  const code = params.get('code');
  if (!code) return { error: 'no_code' };
  if (expectedState !== null && params.get('state') !== expectedState) return { error: 'state_mismatch' };
  return { code };
}

export function expiresAtFrom(expiresInSeconds: number, now: number): number {
  return now + expiresInSeconds * 1000;
}

export function tokenExpired(t: DriveTokens | null, now: number): boolean {
  if (!t) return true;
  return t.expiresAt - EXPIRY_SKEW_MS <= now;
}

/** A connection that has expired and has no refresh token is over: the web
    flow must ask again. One that has a refresh token can heal itself. */
export function needsReconsent(t: DriveTokens | null, now: number): boolean {
  return tokenExpired(t, now) && (t === null || t.refreshToken === null);
}

/* ---------- versions in the appdata folder ---------- */

export const DRIVE_FILE_PREFIX = 'ltd-vault-';
const NAME_RE = /^ltd-vault-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json\.gz$/;

/** ISO, colon-free (Drive is happy either way; humans reading a file list on
    a laptop are not, and neither is Windows if it is ever downloaded). */
export function driveFileName(at: Date): string {
  return `${DRIVE_FILE_PREFIX}${at.toISOString().replace(/[:.]/g, '-')}.json.gz`;
}

/** The timestamp back out of the name — so ordering never depends on Drive's
    own metadata, which a restore screen may be reading from a stale list. */
export function fileTime(name: string): number | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`);
  return Number.isNaN(t) ? null : t;
}

function stamp(f: DriveFile): number {
  const own = fileTime(f.name);
  if (own !== null) return own;
  const meta = f.createdTime ? Date.parse(f.createdTime) : Number.NaN;
  return Number.isNaN(meta) ? 0 : meta;
}

/** Newest first — the order the restore list draws, and the order pruning
    counts in. Files the app did not write sort last and are never pruned. */
export function sortVersions(files: DriveFile[]): DriveFile[] {
  return [...files].sort((a, b) => stamp(b) - stamp(a));
}

/**
 * Which versions to delete after a successful upload.
 *
 * Only ever files this app named. Anything else in the appdata folder — a
 * future feature's file, something a later version of the app writes — is
 * left alone: "prune my old backups" must never mean "delete what I do not
 * recognise".
 */
export function toPrune(files: DriveFile[], keep: number = DRIVE_KEEP): DriveFile[] {
  const mine = sortVersions(files.filter((f) => fileTime(f.name) !== null));
  return mine.slice(keep);
}

/* ---------- the state machine ---------- */

export type DriveState =
  /** No client id for this platform — the owner's one-time setup is missing. */
  | 'unconfigured'
  /** Configured, but the owner has never opted in (or has disconnected). */
  | 'disconnected'
  /** Opted in, tokens on file. */
  | 'connected';

export function driveState(o: { configured: boolean; tokens: DriveTokens | null }): DriveState {
  if (!o.configured) return 'unconfigured';
  return o.tokens ? 'connected' : 'disconnected';
}

/**
 * THE GATE. Nothing in lib/data/drive.ts calls fetch without asking this
 * first, and it is false in every state the rehearsal ever runs in: with a
 * null client id the state is 'unconfigured', so airplane mode is not even
 * the reason zero requests happen — there is no code path to one.
 */
export function mayReachDrive(o: { state: DriveState; online: boolean }): boolean {
  return o.state === 'connected' && o.online;
}

/**
 * Should the debounced auto-backup actually upload?
 *
 * Offline is NOT a failure here and never surfaces as one: being off the
 * network is the normal condition of this trip, so the answer is simply
 * "not now" — no spinner, no error, no toast, and `lastBackupAt` keeps
 * telling the truth about the last one that worked.
 */
export function shouldAutoBackup(o: {
  state: DriveState;
  online: boolean;
  lastBackupAt: number | null;
  lastMutationAt: number;
  now: number;
  minGapMs?: number;
}): boolean {
  if (!mayReachDrive(o)) return false;
  if (!o.lastMutationAt) return false;
  if (o.lastBackupAt === null) return true;
  /* Nothing has changed since the last upload — do not spend a request on it. */
  if (o.lastMutationAt <= o.lastBackupAt) return false;
  return o.now - o.lastBackupAt >= (o.minGapMs ?? 0);
}

/**
 * Multipart body for Drive's uploadType=multipart.
 *
 * The boundary is forced to lower case, and that is not cosmetic: the caller
 * sends `blob.type` as the Content-Type header, and the Blob constructor
 * lower-cases the type it is given. An upper-case boundary would therefore
 * announce `boundary=abc` while the body separated its parts with `--ABC`,
 * and Google would reject the upload for a reason no error message explains.
 */
export function multipartBody(
  boundary: string,
  metadata: Record<string, unknown>,
  contentType: string,
  data: BlobPart,
): Blob {
  const b = boundary.toLowerCase();
  const head = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${b}\r\nContent-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${b}--\r\n`;
  return new Blob([head, data, tail], { type: `multipart/related; boundary=${b}` });
}

/** Short, human, and never a stack trace: this ends up on a card the owner
    reads in a hotel room, not in a console. */
export function driveErrorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'Drive did not answer';
}
