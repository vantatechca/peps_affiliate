const API_BASE = '/api';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () => request('/auth/me'),

  // Affiliate
  affiliateDashboard: () => request('/affiliate/dashboard'),
  affiliateOrders: (period?: string, page = 1) =>
    request(`/affiliate/orders?period=${period || ''}&page=${page}`),
  affiliatePayouts: () => request('/affiliate/payouts'),

  // Admin
  getAffiliates: () => request('/admin/affiliates'),
  createAffiliate: (data: any) =>
    request('/admin/affiliates', { method: 'POST', body: JSON.stringify(data) }),
  updateAffiliate: (id: string, data: any) =>
    request(`/admin/affiliates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAffiliate: (id: string) =>
    request(`/admin/affiliates/${id}`, { method: 'DELETE' }),

  getCodes: () => request('/admin/codes'),
  createCode: (data: any) =>
    request('/admin/codes', { method: 'POST', body: JSON.stringify(data) }),
  updateCode: (id: string, data: any) =>
    request(`/admin/codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCode: (id: string) =>
    request(`/admin/codes/${id}`, { method: 'DELETE' }),

  getOrders: (params?: any) => {
    const qs = new URLSearchParams(params || {}).toString();
    return request(`/admin/orders?${qs}`);
  },

  getPayouts: () => request('/admin/payouts'),
  createPayout: (data: any) =>
    request('/admin/payouts', { method: 'POST', body: JSON.stringify(data) }),
  updatePayout: (id: string, data: any) =>
    request(`/admin/payouts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Charts
  affiliateWeekly: () => request('/charts/affiliate/weekly'),
  affiliateMonthly: () => request('/charts/affiliate/monthly'),
  adminWeekly: (affiliateId?: string) =>
    request(`/charts/admin/weekly${affiliateId ? `?affiliateId=${affiliateId}` : ''}`),
  adminMonthly: (affiliateId?: string) =>
    request(`/charts/admin/monthly${affiliateId ? `?affiliateId=${affiliateId}` : ''}`),
  adminTopAffiliates: () => request('/charts/admin/top-affiliates'),

  adminStats: (affiliateId?: string) =>
    request(`/admin/stats${affiliateId ? `?affiliateId=${affiliateId}` : ''}`),
};
