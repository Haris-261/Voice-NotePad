import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import AdminPage from './AdminPage.jsx';
import { api, getToken, setToken } from './api.js';

export default function App() {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(Boolean(getToken())); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [form, setForm] = useState({ email: '', password: '' }); const [theme, setTheme] = useState(localStorage.getItem('admin-theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('admin-theme', theme); }, [theme]);
  useEffect(() => { if (!getToken()) return setLoading(false); api('/auth/me').then(data => data.user.role === 'admin' ? setUser(data.user) : setToken(null)).catch(() => setToken(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => { const expired = () => setUser(null); addEventListener('admin-auth:expired', expired); return () => removeEventListener('admin-auth:expired', expired); }, []);
  const login = async event => { event.preventDefault(); setError(''); try { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(form) }); if (data.user.role !== 'admin') throw new Error('This account is not an administrator'); setToken(data.token); setUser(data.user); } catch (error) { setError(error.message); } };
  if (loading) return <div className="splash">Opening admin…</div>;
  if (user) return <AdminPage {...{ user, theme, setTheme }} logout={() => { setToken(null); setUser(null); }} />;
  return <main className="auth-page"><div className="auth-brand"><span className="logo"><span>V</span></span><strong>Voice NotePad Admin</strong></div><section className="auth-card"><p className="eyebrow">SECURE ADMIN</p><h1>Administrator sign in</h1><p className="muted">Manage users, notes and account security.</p><form onSubmit={login}><label>Email<input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Password<div className="password"><input type={show ? 'text' : 'password'} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <p className="error">{error}</p>}<button className="primary wide">Sign in to admin</button></form></section></main>;
}
