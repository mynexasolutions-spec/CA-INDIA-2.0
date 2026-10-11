const API = '/api';
const TOKEN_KEY = 'abkhan_token';

export async function api(path, opts = {}) {
  const token = getAuthToken();
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  const isFormData = opts.body instanceof FormData;

  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  if (!isFormData && opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOpts = { method, headers };
  if (opts.body !== undefined) {
    fetchOpts.body = isFormData ? opts.body : JSON.stringify(opts.body);
  }

  const res = await fetch(API + path, fetchOpts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data.message ||
      (data.errors && Object.values(data.errors).flat()[0]) ||
      'Request failed';
    const err = new Error(typeof msg === 'string' ? msg : 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function setAuthToken(token, remember = true) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (!token) return;
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}
