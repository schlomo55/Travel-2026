/** Random id for app-created records. Seed/import ids are deterministic slugs instead. */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* insecure context (LAN-IP dev) — fall through */
  }
  return 'x' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}
