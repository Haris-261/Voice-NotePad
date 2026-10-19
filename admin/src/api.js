const tokenKey = 'voice-notepad-admin-token';
const apiBase = import.meta.env.VITE_API_URL || '';
export const getToken = () => localStorage.getItem(tokenKey);
export const setToken = token => token ? localStorage.setItem(tokenKey, token) : localStorage.removeItem(tokenKey);
export async function api(path, options = {}) {
  const response = await fetch(`${apiBase}/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...options.headers } });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/auth/login')) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('admin-auth:expired'));
  }
  if (!response.ok) throw new Error(data?.detail || data?.message || 'Request failed');
  return data;
}
