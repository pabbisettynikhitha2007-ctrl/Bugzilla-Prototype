const BASE_URL = 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('bt_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),

  listBugs: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/bugs${qs ? `?${qs}` : ''}`);
  },
  getBug: (id) => request(`/bugs/${id}`),
  createBug: (payload) => request('/bugs', { method: 'POST', body: payload }),
  updateBug: (id, payload) => request(`/bugs/${id}`, { method: 'PATCH', body: payload }),
  addComment: (id, body) => request(`/bugs/${id}/comments`, { method: 'POST', body: { body } }),
  getStats: () => request('/bugs/stats/summary'),

  listUsers: () => request('/meta/users'),
  listProducts: () => request('/meta/products'),

  listNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};
