/**
 * Fetch wrapper that returns a safe default when the response is not OK
 * (e.g. 403 Forbidden for users without permission).
 *
 * Usage:
 *   const data = await safeFetchJson<MyType[]>("/api/foo", []);
 *   const data = await safeFetchJson<{ summary: ...; details: ... }>("/api/bar", null);
 */
export async function safeFetchJson<T>(
  url: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return fallback;
    const data = await res.json();
    return data as T;
  } catch {
    return fallback;
  }
}
