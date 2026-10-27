const KEY = 'optima.api.token.v1';
export function getToken() { return sessionStorage.getItem(KEY) || ''; }
export function setToken(value) { if (value) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY); }
export async function request(path, {method = 'GET', body, token = getToken(), blob = false} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch('/api/v1' + path, {method, headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)});
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const fields = (data.error?.fields || []).map(f => f.message).join('; ');
    const error = new Error((data.error?.message || `Ошибка сервера ${response.status}`) + (fields ? ': ' + fields : ''));
    error.status = response.status; error.code = data.error?.code; throw error;
  }
  return blob ? response.blob() : response.json();
}
export async function all(path, options = {}) {
  const items = []; let cursor = null;
  do {
    const page = await request(path + (path.includes('?') ? '&' : '?') + 'limit=100' + (cursor ? '&cursor=' + cursor : ''), options);
    items.push(...page.items); cursor = page.next_cursor;
  } while (cursor);
  return items;
}
