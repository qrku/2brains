/**
 * Guard for URLs that end up in `href` / `src`.
 *
 * HTML-escaping (`&<>"`) does not touch the scheme, so it gives no protection
 * against `javascript:` / `data:` / `vbscript:` URLs — they need a whitelist.
 *
 * Rule: a URL with an explicit scheme must use one of the allowed ones;
 * a URL without a scheme (absolute path, relative path, anchor, query) is safe.
 */
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

export function isSafeUrl(raw: string): boolean {
  const m = raw.match(/^([^:/?#]*):/);
  if (!m) return true; // no scheme — relative/absolute path, anchor or query
  // Browsers drop whitespace and control characters before resolving the
  // scheme, so `java\tscript:alert(1)` must be normalised before the check.
  return ALLOWED_SCHEMES.includes(m[1].replace(/[^a-z0-9+.-]/gi, '').toLowerCase());
}

/** Returns `raw` if its scheme is allowed, otherwise `fallback` (default `#`). */
export function safeUrl(raw: string, fallback = '#'): string {
  return isSafeUrl(raw) ? raw : fallback;
}
