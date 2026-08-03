/**
 * The API is a separate service (Render) from the UI (Vercel), so every request
 * has to be addressed absolutely. NEXT_PUBLIC_API_BASE_URL is inlined at build
 * time — it must be set in the Vercel project before the frontend is built.
 *
 * Left unset, requests fall back to same-origin relative paths, which is what
 * `npm run dev:all` wants when the Next dev server proxies /api to localhost.
 */
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '')

/** Resolves an API path (`/api/runs`) against the configured backend origin. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${BASE_URL}${normalized}`
}

/** fetch() against the API service. Same signature as fetch, minus the origin. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init)
}
