const tokenKey = 'voice-notepad-token';
const apiBase = import.meta.env.VITE_API_URL || '';
export const getToken = () => localStorage.getItem(tokenKey);
export const setToken = token => token ? localStorage.setItem(tokenKey, token) : localStorage.removeItem(tokenKey);

export async function api(path, options = {}) {
  const response = await fetch(`${apiBase}/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...options.headers }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/signup')) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  if (!response.ok) throw new Error(data.detail || data.message || 'Something went wrong');
  return data;
}
