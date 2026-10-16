// Minimal API client for the FieldGuard backend.
//
// In production the Static Web App serves this app and proxies `/api/*` to the
// linked Function App (same origin — no CORS). For local `npm run dev`, Vite
// proxies `/api` to the local Functions host (see vite.config.js). Set
// VITE_API_URL only to call an absolute backend base instead of the proxy.
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function getJSON(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

export const getFields = () => getJSON('/fields');
export const getRisk = () => getJSON('/risk');
export const getFarmDetail = (fieldId) => getJSON(`/farms/${encodeURIComponent(fieldId)}`);

export { API_BASE };
