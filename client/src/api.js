// Тонкая обёртка над fetch для работы с API.
let translation = 'synodal';
export function setApiTranslation(value) { translation = value; }

async function request(path, { method = 'GET', body } = {}) {
  const url = new URL('/api' + path, window.location.origin);
  if (method === 'GET' && path !== '/translations' && path !== '/auth/me') {
    url.searchParams.set('translation', translation);
  }
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || 'Ошибка запроса');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
};
