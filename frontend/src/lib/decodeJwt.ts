// Client-side only, for UI gating (which nav links/buttons to show) — never
// trust this for real authorization, the backend independently enforces
// every admin-only action regardless of what the UI shows. No signature
// verification needed here since we're not making a security decision, just
// reading a claim we already received via an authenticated response.
export function decodeJwt<T = Record<string, unknown>>(token: string | null): T | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))) as T;
  } catch {
    return null;
  }
}
