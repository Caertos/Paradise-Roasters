export const DEFAULT_AUTHENTICATED_PATH = "/user";

/**
 * Returns `raw` only when it is a same-origin relative path ("/user?tab=1"),
 * so a crafted `?redirect=` can never send the user to another site.
 */
export function safeRedirect(
  raw: string | null | undefined,
  fallback = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\s]/.test(raw)) return fallback;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
