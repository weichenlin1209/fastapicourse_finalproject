import { getToken, clearToken } from './utils.js';

const API_BASE = '/api/v1';

let _onPasswordChangeRequired = null;

/**
 * Register a callback that fires when a 403 "Password change required"
 * response is received from any API call.
 */
export function onPasswordChangeRequired(cb) {
  _onPasswordChangeRequired = cb;
}

/**
 * Core request wrapper.
 *
 *  • Injects Authorization: Bearer <token> on every request.
 *  • On 401 → clears token, reloads the page (forces re-login).
 *  • On 403 with "Password change required" → calls the registered
 *    handler so the app can show the forced-reset modal.
 *  • Throws on any non-2xx / non-204 response.
 */
async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error('Network error — is the server running?');
  }

  // -- 401: token expired or invalid → force re-login
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Session expired');
  }

  // -- 403: check for forced password change
  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    if (
      body.detail &&
      typeof body.detail === 'string' &&
      body.detail.toLowerCase().includes('password change required')
    ) {
      if (_onPasswordChangeRequired) _onPasswordChangeRequired();
      throw new Error('Password change required');
    }
    throw new Error(body.detail || 'Forbidden');
  }

  // -- 204: No Content (DELETE, etc.)
  if (response.status === 204) return null;

  // -- Any other non-ok status
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    let msg = body.detail;
    if (Array.isArray(msg)) {
      msg = msg.map((e) => (e.msg || e.message || JSON.stringify(e))).join("; ");
    }
    throw new Error(msg || `Request failed (${response.status})`);
  }

  return response.json();
}

export const api = {
  get:   (path)           => request(path),
  post:  (path, data)     => request(path, { method: 'POST',  body: JSON.stringify(data) }),
  patch: (path, data)     => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete:(path)           => request(path, { method: 'DELETE' }),
};
