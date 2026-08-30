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
  findSimilarBugs: (title, description) => {
    const qs = new URLSearchParams({ title: title || '', description: description || '' }).toString();
    return request(`/bugs/similar?${qs}`);
  },

  watchBug: (id) => request(`/bugs/${id}/watch`, { method: 'POST' }),
  unwatchBug: (id) => request(`/bugs/${id}/watch`, { method: 'DELETE' }),

  listAttachments: (bugId) => request(`/bugs/${bugId}/attachments`),
  uploadAttachment: async (bugId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const res = await fetch(`${BASE_URL}/bugs/${bugId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  downloadAttachment: async (id, filename) => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/attachments/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  deleteAttachment: (id) => request(`/attachments/${id}`, { method: 'DELETE' }),

  listUsers: () => request('/meta/users'),
  listProducts: () => request('/meta/products'),

  listNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};
