import { useEffect, useState } from 'react';
import { Archive, Eye, EyeOff, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { api } from './api.js';

const money = value => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = value => new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium' }).format(new Date(value));
function NoteDetails({ note }) {
  if ((note.noteType || 'spend') === 'simple') return <div className="admin-note-detail"><mark>Simple</mark><p>{note.content || 'No English text'}</p>{note.contentUrdu && <p className="urdu" dir="rtl">{note.contentUrdu}</p>}</div>;
  return <div className="admin-note-detail"><mark>Spend</mark>{note.items.length ? <ul>{note.items.map(item => <li key={item.id}><span>{item.englishName}<small>{item.urduName}{item.romanName ? ` · ${item.romanName}` : ''}</small></span><strong>{money(item.amount)}</strong></li>)}</ul> : <p>No items</p>}</div>;
}

export default function AdminPage({ user, logout, theme, setTheme }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { Promise.all([api('/admin/users'), api('/admin/notes')]).then(([u, n]) => { setUsers(u.users); setNotes(n.notes); }).catch(error => setError(error.message)); }, []);
  const changePassword = async event => {
    event.preventDefault(); setError(''); setMessage('');
    try {
      await api('/admin/password', { method: 'PATCH', body: JSON.stringify(passwords) });
      setPasswords({ currentPassword: '', newPassword: '' }); setMessage('Admin password changed successfully.');
    } catch (error) { setError(error.message); }
  };
  return <div className="app-shell">
    <header><button className="brand" onClick={() => location.assign('/')}><span className="logo"><span>V</span></span><span>Voice NotePad Admin</span></button><div className="header-actions"><button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button><button className="avatar">{user.name[0].toUpperCase()}</button><button className="icon-button" onClick={logout}><LogOut size={19} /></button></div></header>
    <main className="admin-page"><div className="admin-title"><div><p className="eyebrow">ADMINISTRATION</p><h1>Workspace overview</h1></div><button className="secondary" onClick={() => location.assign('/')}>Back to notes</button></div>
      <div className="stats"><div><span>Users</span><strong>{users.length}</strong></div><div><span>Notes</span><strong>{notes.length}</strong></div><div><span>Total items</span><strong>{notes.reduce((sum, note) => sum + note.items.length, 0)}</strong></div></div>
      <section className="password-card"><div><p className="eyebrow">SECURITY</p><h2>Change admin password</h2><p>Use at least 8 characters. You will use the new password on your next login.</p></div><form onSubmit={changePassword}><div className="password"><input required minLength="8" type={showPasswords ? 'text' : 'password'} placeholder="Current password" value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} /><button type="button" onClick={() => setShowPasswords(!showPasswords)}>{showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><input required minLength="8" type={showPasswords ? 'text' : 'password'} placeholder="New password" value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} /><button className="primary">Update password</button></form>{message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}</section>
      <div className="tabs"><button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><UserRound size={17} /> Users</button><button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}><Archive size={17} /> Notes</button></div>
      <div className="table-wrap">{tab === 'users' ? <table><thead><tr><th>User</th><th>Role</th><th>Notes</th><th>Joined</th></tr></thead><tbody>{users.map(row => <tr key={row._id}><td><strong>{row.name}</strong><span>{row.email}</span></td><td><mark>{row.role}</mark></td><td>{row.noteCount}</td><td>{dateLabel(row.createdAt)}</td></tr>)}</tbody></table> : <table><thead><tr><th>Note</th><th>Owner</th><th>Contents</th><th>Total</th><th>Updated</th></tr></thead><tbody>{notes.map(row => <tr key={row._id}><td><strong>{row.title}</strong></td><td><span>{row.owner?.name}<br />{row.owner?.email}</span></td><td><NoteDetails note={row} /></td><td>{(row.noteType || 'spend') === 'spend' ? money(row.items.reduce((sum, item) => sum + Number(item.amount || 0), 0)) : '—'}</td><td>{dateLabel(row.updatedAt)}</td></tr>)}</tbody></table>}</div>
    </main>
  </div>;
}
