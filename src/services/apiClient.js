const API_URL = (import.meta.env.VITE_API_URL || 'https://api-control-bodega.rtdev.uk').replace(/\/$/, '');
const TOKEN_KEY = 'control-bodega-jwt';
const USER_KEY = 'control-bodega-user';
const AUTH_EVENT = 'control-bodega-auth-changed';
const REQUEST_TIMEOUT = 15000;

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getSession() {
  const token = getToken();
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token) return null;
  let usuario = null;
  try { usuario = rawUser ? JSON.parse(rawUser) : null; } catch { usuario = null; }
  return { access_token: token, token, usuario };
}
function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); window.dispatchEvent(new Event(AUTH_EVENT)); }
export function signOut() { clearSession(); return Promise.resolve(); }
export function onAuthStateChange(callback) { const handler = () => callback(getSession()); window.addEventListener(AUTH_EVENT, handler); return () => window.removeEventListener(AUTH_EVENT, handler); }

async function request(path, options = {}) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const token = getToken(); if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    let body = null; try { body = await response.json(); } catch { body = null; }
    if (response.status === 401) {
      const apiMessage = body?.message || body?.error || 'Credenciales incorrectas';
      if (path === '/api/auth/login') throw new Error(apiMessage);
      clearSession();
      throw new Error('La sesión expiró. Inicia sesión nuevamente cuando tengas Internet.');
    }
    if (!response.ok || body?.ok === false) throw new Error(body?.message || body?.error || `Error HTTP ${response.status}`);
    return body;
  } catch (error) { if (error.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Comprueba tu conexión.'); throw error; }
  finally { clearTimeout(timeout); }
}
export async function signIn(identificador, password) {
  const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identificador, password }) });
  if (!response.token || !response.usuario) throw new Error('La respuesta de autenticación no es válida.');
  localStorage.setItem(TOKEN_KEY, response.token); localStorage.setItem(USER_KEY, JSON.stringify(response.usuario)); window.dispatchEvent(new Event(AUTH_EVENT));
  return { session: getSession(), ...response };
}
export function apiRequest(path, options) { return request(path, options); }
export { API_URL };
