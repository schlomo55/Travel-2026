/* Google Drive backup, proved without a Google account.
 *
 * The owner's OAuth client id does not exist yet and the real sign-in is a
 * step only they can take on the phone, so the burden of proof falls here:
 * the token dance, expiry and refresh, the pruning arithmetic, the payload
 * round-trip, and — the one that matters most — the promise that nothing in
 * this feature can reach the network while it is not connected.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVE_KEEP,
  DRIVE_SCOPE,
  EXPIRY_SKEW_MS,
  authUrl,
  base64Url,
  challengeFor,
  driveErrorText,
  driveFileName,
  driveState,
  expiresAtFrom,
  fileTime,
  mayReachDrive,
  multipartBody,
  needsReconsent,
  parseRedirect,
  randomVerifier,
  shouldAutoBackup,
  sortVersions,
  toPrune,
  tokenExpired,
  verifierFrom,
  type DriveFile,
  type DriveTokens,
} from '../lib/logic/drive';
import { DRIVE_CONFIG, driveClientId, driveConfigured, driveRedirectUri } from '../lib/data/driveConfig';
import { parseBackupText } from '../lib/logic/backup';

function tokens(patch: Partial<DriveTokens> = {}): DriveTokens {
  return { accessToken: 'at', refreshToken: 'rt', expiresAt: 0, connectedAt: 0, ...patch };
}
function file(name: string, id = name): DriveFile {
  return { id, name };
}

/* ---------- PKCE ---------- */

describe('PKCE', () => {
  it('builds a verifier of legal length from the unreserved set', () => {
    const v = randomVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('never needs URL escaping', () => {
    const v = verifierFrom(new Uint8Array(Array.from({ length: 64 }, (_, i) => i * 3)));
    expect(encodeURIComponent(v)).toBe(v);
  });

  it('gives a different verifier each time', () => {
    expect(randomVerifier()).not.toBe(randomVerifier());
  });

  it('base64url has no padding and no + or /', () => {
    const s = base64Url(new Uint8Array([251, 255, 190, 0, 1]));
    expect(s).not.toMatch(/[+/=]/);
  });

  /* The vector from RFC 7636 appendix B — if this drifts, Google rejects the
     exchange with a message that says nothing useful. */
  it('matches the RFC 7636 S256 test vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(await challengeFor(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('challenge is a pure function of the verifier', async () => {
    const v = randomVerifier();
    expect(await challengeFor(v)).toBe(await challengeFor(v));
    expect(await challengeFor(v)).not.toBe(await challengeFor(randomVerifier()));
  });

  it('asks for appdata only, with S256 and an offline grant', () => {
    const url = new URL(authUrl({ clientId: 'cid', redirectUri: 'x:/y', challenge: 'ch', state: 'st' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe(DRIVE_SCOPE);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    /* drive.file or drive would let the app see the owner's own Drive. It
       must never ask for more than its own folder. */
    expect(url.searchParams.get('scope')).not.toMatch(/drive($|[^.])/);
  });
});

describe('the redirect', () => {
  it('reads the code out of the custom-scheme URL', () => {
    const r = parseRedirect('com.livingthedream.travel:/oauth2redirect?code=abc123&state=st', 'st');
    expect(r).toEqual({ code: 'abc123' });
  });

  it('refuses a mismatched state', () => {
    const r = parseRedirect('com.livingthedream.travel:/oauth2redirect?code=abc&state=other', 'st');
    expect(r).toEqual({ error: 'state_mismatch' });
  });

  it('reports Google saying no', () => {
    expect(parseRedirect('x:/y?error=access_denied', null)).toEqual({ error: 'access_denied' });
  });

  it('treats a code-less redirect as a failure, not a success', () => {
    expect(parseRedirect('x:/y', null)).toEqual({ error: 'no_code' });
  });
});

/* ---------- expiry & refresh ---------- */

describe('token expiry', () => {
  it('counts from now plus expires_in', () => {
    expect(expiresAtFrom(3600, 1000)).toBe(1000 + 3_600_000);
  });

  it('treats a token as dead a minute early', () => {
    const t = tokens({ expiresAt: 100_000 });
    expect(tokenExpired(t, 100_000 - EXPIRY_SKEW_MS - 1)).toBe(false);
    expect(tokenExpired(t, 100_000 - EXPIRY_SKEW_MS)).toBe(true);
    expect(tokenExpired(t, 100_000)).toBe(true);
  });

  it('a missing token is an expired token', () => {
    expect(tokenExpired(null, 0)).toBe(true);
  });

  it('only a refresh token can heal an expired connection', () => {
    const now = 1_000_000;
    expect(needsReconsent(tokens({ expiresAt: now + 999_999 }), now)).toBe(false);
    expect(needsReconsent(tokens({ expiresAt: 0 }), now)).toBe(false); // has rt → refreshable
    expect(needsReconsent(tokens({ expiresAt: 0, refreshToken: null }), now)).toBe(true); // web flow
    expect(needsReconsent(null, now)).toBe(true);
  });
});

/* ---------- versions & pruning ---------- */

describe('versions', () => {
  it('names a file with a sortable ISO stamp that parses back', () => {
    const at = new Date('2026-11-22T04:05:06.789Z');
    const name = driveFileName(at);
    expect(name).toBe('ltd-vault-2026-11-22T04-05-06-789Z.json.gz');
    expect(fileTime(name)).toBe(at.getTime());
  });

  it('does not recognise files it did not write', () => {
    expect(fileTime('holiday-photos.zip')).toBeNull();
    expect(fileTime('ltd-vault-nonsense.json.gz')).toBeNull();
  });

  it('sorts newest first', () => {
    const list = [
      file('ltd-vault-2026-11-20T00-00-00-000Z.json.gz'),
      file('ltd-vault-2026-12-01T00-00-00-000Z.json.gz'),
      file('ltd-vault-2026-11-25T00-00-00-000Z.json.gz'),
    ];
    expect(sortVersions(list).map((f) => f.name.slice(10, 20))).toEqual(['2026-12-01', '2026-11-25', '2026-11-20']);
  });

  it('keeps ten and prunes the rest, oldest going first', () => {
    const list = Array.from({ length: 14 }, (_, i) =>
      file(`ltd-vault-2026-11-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.json.gz`),
    );
    const doomed = toPrune(list, DRIVE_KEEP);
    expect(doomed).toHaveLength(4);
    /* The four oldest — the 1st to the 4th of November. */
    expect(doomed.map((f) => f.name.slice(18, 20)).sort()).toEqual(['01', '02', '03', '04']);
    expect(toPrune(list.slice(0, 10), DRIVE_KEEP)).toEqual([]);
  });

  it('NEVER prunes a file this app did not name', () => {
    const list = [
      ...Array.from({ length: 12 }, (_, i) =>
        file(`ltd-vault-2026-11-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.json.gz`),
      ),
      file('someone-elses-thing.json'),
      file('config.txt'),
    ];
    const doomed = toPrune(list, DRIVE_KEEP);
    expect(doomed).toHaveLength(2);
    expect(doomed.every((f) => f.name.startsWith('ltd-vault-'))).toBe(true);
  });
});

/* ---------- the state machine and THE GATE ---------- */

describe('state machine', () => {
  it('a missing client id is "unconfigured", tokens or not', () => {
    expect(driveState({ configured: false, tokens: null })).toBe('unconfigured');
    expect(driveState({ configured: false, tokens: tokens() })).toBe('unconfigured');
  });

  it('configured but not opted in is "disconnected"', () => {
    expect(driveState({ configured: true, tokens: null })).toBe('disconnected');
  });

  it('configured and opted in is "connected"', () => {
    expect(driveState({ configured: true, tokens: tokens() })).toBe('connected');
  });
});

describe('the network gate', () => {
  it('is shut in every state but connected-and-online', () => {
    expect(mayReachDrive({ state: 'unconfigured', online: true })).toBe(false);
    expect(mayReachDrive({ state: 'disconnected', online: true })).toBe(false);
    expect(mayReachDrive({ state: 'connected', online: false })).toBe(false);
    expect(mayReachDrive({ state: 'connected', online: true })).toBe(true);
  });

  /* §RULES: offline is sacred. This is the shipped configuration. */
  it('is shut for the build that ships, on both platforms', () => {
    expect(DRIVE_CONFIG.webClientId).toBeNull();
    expect(DRIVE_CONFIG.androidClientId).toBeNull();
    expect(driveConfigured(true)).toBe(false);
    expect(driveConfigured(false)).toBe(false);
    expect(driveClientId(true)).toBeNull();
    expect(mayReachDrive({ state: driveState({ configured: driveConfigured(true), tokens: null }), online: true })).toBe(
      false,
    );
  });

  it('the redirect uri matches the manifest intent filter', () => {
    expect(driveRedirectUri()).toBe('com.livingthedream.travel:/oauth2redirect');
  });
});

describe('auto-backup', () => {
  const base = { state: 'connected' as const, online: true, lastMutationAt: 5_000, now: 10_000 };

  it('runs when something changed and never has been backed up', () => {
    expect(shouldAutoBackup({ ...base, lastBackupAt: null })).toBe(true);
  });

  it('does nothing when nothing changed since the last copy', () => {
    expect(shouldAutoBackup({ ...base, lastBackupAt: 6_000 })).toBe(false);
  });

  /* OFFLINE IS NOT A FAILURE. It is the normal condition of this trip: the
     answer is "not now", and no spinner, error or toast may come of it. */
  it('is silent and false while offline', () => {
    expect(shouldAutoBackup({ ...base, online: false, lastBackupAt: null })).toBe(false);
  });

  it('cannot run at all while unconfigured or disconnected', () => {
    expect(shouldAutoBackup({ ...base, state: 'unconfigured', lastBackupAt: null })).toBe(false);
    expect(shouldAutoBackup({ ...base, state: 'disconnected', lastBackupAt: null })).toBe(false);
  });

  it('respects the minimum gap between uploads', () => {
    expect(shouldAutoBackup({ ...base, lastBackupAt: 4_000, minGapMs: 60_000 })).toBe(false);
    expect(shouldAutoBackup({ ...base, lastBackupAt: 4_000, minGapMs: 1_000 })).toBe(true);
  });

  it('does nothing on a vault that has never been touched', () => {
    expect(shouldAutoBackup({ ...base, lastMutationAt: 0, lastBackupAt: null })).toBe(false);
  });
});

/* ---------- payload ---------- */

describe('payload', () => {
  /* The header Google reads is `blob.type`, and the Blob constructor
     lower-cases it. If the body kept a mixed-case boundary the two would not
     agree and the upload would be rejected — so the boundary is normalised. */
  it('wraps the backup bytes in a multipart body whose boundary matches its own header', async () => {
    const body = multipartBody('BoUnD', { name: 'x.json.gz', parents: ['appDataFolder'] }, 'application/gzip', 'DATA');
    expect(body.type).toBe('multipart/related; boundary=bound');
    const text = await body.text();
    const declared = /boundary=(\S+)$/.exec(body.type)?.[1];
    expect(declared).toBeTruthy();
    expect(text).toContain(`--${declared}`);
    expect(text.trimEnd().endsWith(`--${declared}--`)).toBe(true);
    expect(text).toContain('"parents":["appDataFolder"]');
    expect(text).toContain('DATA');
  });

  /* What goes up must come back as something the EXISTING importer accepts —
     the restore path hands it to the same staged preview a file does. */
  it('round-trips through gzip into the importer', async () => {
    const { gzipText, readBackupFile } = await import('../lib/logic/backup');
    const envelope = {
      format: 'livingthedream/backup',
      formatVersion: 1,
      kind: 'vault',
      exportedAt: new Date().toISOString(),
      appVersion: '2.0.0',
      trips: [{ trip: { id: 't1', title: 'China 2026' } }],
    };
    const blob = await gzipText(JSON.stringify(envelope));
    const back = await readBackupFile(new File([blob], driveFileName(new Date()), { type: 'application/gzip' }));
    expect(back.format).toBe('livingthedream/backup');
    expect(back.trips[0]?.trip.title).toBe('China 2026');
    /* and the plain path still works, for a copy read as text */
    expect(parseBackupText(JSON.stringify(envelope)).kind).toBe('vault');
  });
});

/* ---------- what a backup may never carry ---------- */

describe('tokens stay on the phone', () => {
  it('the export envelope has no field that could hold them', async () => {
    const { buildBackup } = await import('../lib/data/export');
    const { db } = await import('../lib/db/db');
    await db.meta.put({ key: 'drive.tokens', value: tokens({ accessToken: 'SECRET-ACCESS-TOKEN' }) });
    const backup = await buildBackup([], true);
    const text = JSON.stringify(backup);
    expect(text).not.toContain('SECRET-ACCESS-TOKEN');
    expect(text).not.toContain('drive.tokens');
    expect(text).not.toContain('refreshToken');
  });
});

/* ---------- the effectful layer, against a mocked fetch ---------- */

describe('data/drive against a mocked network', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes ZERO requests while unconfigured — backup, list and auto alike', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const { backupToDrive, listDriveVersions, noteMutation, currentDriveState } = await import('../lib/data/drive');

    expect(await currentDriveState()).toBe('unconfigured');
    expect(await backupToDrive()).toBe(false);
    expect(await listDriveVersions()).toEqual([]);
    noteMutation();
    await new Promise((r) => setTimeout(r, 30));

    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('records no error for the offline no-op — "last backup" keeps telling the truth', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const { backupToDrive, readStatus } = await import('../lib/data/drive');
    const before = await readStatus();
    expect(await backupToDrive()).toBe(false);
    const after = await readStatus();
    expect(after.lastError).toBe(before.lastError);
    expect(after.lastBackupAt).toBe(before.lastBackupAt);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('disconnect wipes the tokens even when the revoke cannot be delivered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('no network'))),
    );
    const { db } = await import('../lib/db/db');
    const { disconnectDrive, readTokens } = await import('../lib/data/drive');
    await db.meta.put({ key: 'drive.tokens', value: tokens() });
    expect(await readTokens()).not.toBeNull();
    await disconnectDrive();
    expect(await readTokens()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('error text', () => {
  it('is short, human, and never empty', () => {
    expect(driveErrorText(new Error('Drive refused the upload (403)'))).toBe('Drive refused the upload (403)');
    expect(driveErrorText('quota')).toBe('quota');
    expect(driveErrorText(undefined)).toBe('Drive did not answer');
    expect(driveErrorText(new Error(''))).toBe('Drive did not answer');
  });
});
