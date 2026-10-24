import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, CalendarDays, Download, Eye, EyeOff, FileText, LogOut, Mic, Moon, Plus, Search, Sun, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import { api, getToken, setToken } from './api.js';
import { deleteLocal, localDb, saveLocal } from './db.js';

const uid = () => crypto.randomUUID();
const money = value => `Rs ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(value || 0)}`;
const displayDate = value => new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium' }).format(new Date(value));
const inputDate = value => new Date(value).toISOString().slice(0, 10);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => {
    if (!getToken()) return setLoading(false);
    api('/auth/me').then(data => setUser(data.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { const expired = () => setUser(null); addEventListener('auth:expired', expired); return () => removeEventListener('auth:expired', expired); }, []);
  if (loading) return <div className="splash"><Logo /><span>Opening your notes…</span></div>;
  if (!user) return <Auth onAuth={setUser} theme={theme} setTheme={setTheme} />;
  return <Notes user={user} logout={() => { setToken(null); setUser(null); }} theme={theme} setTheme={setTheme} />;
}

function Logo() { return <span className="logo"><span>V</span></span>; }
function ThemeButton({ theme, setTheme }) { return <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>; }

function Auth({ onAuth, theme, setTheme }) {
  const [mode, setMode] = useState('login'); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { const data = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) }); setToken(data.token); onAuth(data.user); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  return <main className="auth-page"><div className="auth-brand"><Logo /><strong>Voice NotePad</strong><ThemeButton {...{ theme, setTheme }} /></div><section className="auth-card"><p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'START WRITING'}</p><h1>{mode === 'login' ? 'Your notes, your voice.' : 'Create your account.'}</h1><p className="muted">English, Urdu and Roman Urdu expense notes.</p><form onSubmit={submit}>{mode === 'signup' && <label>Name<input required minLength="2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Password<div className="password"><input required minLength="8" type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <p className="error">{error}</p>}<button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button></form><p className="switch">{mode === 'login' ? 'New here?' : 'Already registered?'} <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p></section></main>;
}

function Notes({ user, logout, theme, setTheme }) {
  const [notes, setNotes] = useState([]); const [selected, setSelected] = useState(null); const [query, setQuery] = useState(''); const [date, setDate] = useState(''); const [noteFilter, setNoteFilter] = useState('spend'); const [online, setOnline] = useState(navigator.onLine); const [showCreate, setShowCreate] = useState(false); const [deleteTarget, setDeleteTarget] = useState(null);
  const syncTimer = useRef(null); const syncing = useRef(false);
  const refresh = useCallback(async () => { const rows = await localDb.notes.where('userId').equals(user.id).toArray(); setNotes(rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))); }, [user.id]);
  const sync = useCallback(async () => { if (!navigator.onLine || syncing.current) return; syncing.current = true; try { const jobs = await localDb.queue.where('userId').equals(user.id).toArray(); const failedIds = new Set(); for (const job of jobs) { try { if (job.action === 'delete') await api(`/notes/${job.clientId}`, { method: 'DELETE' }); else await api(`/notes/${job.clientId}`, { method: 'PUT', body: JSON.stringify(job.payload) }); await localDb.queue.delete(job.id); } catch { failedIds.add(job.clientId); } } const stillPending = await localDb.queue.where('userId').equals(user.id).toArray(); stillPending.forEach(job => failedIds.add(job.clientId)); const data = await api('/notes'); for (const note of data.notes) if (!failedIds.has(note.clientId)) await saveLocal(note, user.id, false); await refresh(); } catch {} finally { syncing.current = false; } }, [refresh, user.id]);
  const scheduleSync = useCallback(() => { clearTimeout(syncTimer.current); syncTimer.current = setTimeout(sync, 900); }, [sync]);
  useEffect(() => { refresh().then(sync); const on = () => { setOnline(true); sync(); }; const off = () => setOnline(false); addEventListener('online', on); addEventListener('offline', off); return () => { clearTimeout(syncTimer.current); removeEventListener('online', on); removeEventListener('offline', off); }; }, [refresh, sync]);
  const create = async ({ title, noteType }) => { const now = new Date().toISOString(); const note = { clientId: uid(), title, noteType, content: '', contentUrdu: '', noteDate: now, items: [], updatedAt: now }; await saveLocal(note, user.id); await refresh(); setNoteFilter(noteType); setSelected(note.clientId); setShowCreate(false); sync(); };
  const save = async note => { await saveLocal(note, user.id); await refresh(); scheduleSync(); };
  const remove = id => setDeleteTarget(notes.find(note => note.clientId === id) || { clientId: id, title: 'this note' });
  const confirmRemove = async () => { if (!deleteTarget) return; await deleteLocal(deleteTarget.clientId, user.id); setDeleteTarget(null); setSelected(null); await refresh(); sync(); };
  const visible = notes.filter(note => (note.noteType || 'spend') === noteFilter && (!query || note.title.toLowerCase().includes(query.toLowerCase())) && (!date || inputDate(note.noteDate) === date));
  const active = notes.find(note => note.clientId === selected);
  return <div className="app-shell"><header><span className="brand"><Logo /><span>Voice NotePad</span></span><div className="header-actions"><span className={`status ${online ? '' : 'offline'}`}>{online ? <Wifi size={15} /> : <WifiOff size={15} />}{online ? 'Synced' : 'Offline'}</span><ThemeButton {...{ theme, setTheme }} /><button className="avatar">{user.name[0].toUpperCase()}</button><button className="icon-button" onClick={logout}><LogOut size={19} /></button></div></header><main className="notes-page"><aside className={active ? 'mobile-hidden' : ''}><div className="aside-head"><div><p className="eyebrow">YOUR LIBRARY</p><h1>Notes</h1></div><button className="primary square" onClick={() => setShowCreate(true)}><Plus /></button></div><div className="note-filter-tabs"><button className={noteFilter === 'simple' ? 'active' : ''} onClick={() => { setNoteFilter('simple'); setSelected(null); }}>Simple Notes</button><button className={noteFilter === 'spend' ? 'active' : ''} onClick={() => { setNoteFilter('spend'); setSelected(null); }}>Spend Notes</button></div><div className="search"><Search size={18} /><input placeholder="Search title" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="date-filter"><CalendarDays size={17} /><input type="date" value={date} onChange={e => setDate(e.target.value)} />{date && <button onClick={() => setDate('')}><X size={15} /></button>}</div><div className="note-list">{visible.map(note => <button key={note.clientId} className={`note-row ${selected === note.clientId ? 'active' : ''}`} onClick={() => setSelected(note.clientId)}><div><strong>{note.title}</strong><span>{displayDate(note.noteDate)} · {(note.noteType || 'spend') === 'simple' ? 'Simple note' : `${note.items.length} items`}</span></div>{(note.noteType || 'spend') === 'spend' && <b>{money(note.items.reduce((sum, item) => sum + Number(item.amount), 0))}</b>}</button>)}</div></aside><section className={`editor-panel ${active ? 'active' : ''}`}>{active ? <Editor note={active} onSave={save} onDelete={() => remove(active.clientId)} onBack={() => setSelected(null)} online={online} /> : <div className="blank-state"><h2>Select or create a note</h2><button className="primary" onClick={() => setShowCreate(true)}><Plus size={18} /> Create note</button></div>}</section></main>{showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={create} />}{deleteTarget && <DeleteNoteModal note={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmRemove} />}</div>;
}

function CreateModal({ onClose, onCreate }) {
  const [noteType, setNoteType] = useState(null); const [title, setTitle] = useState('');
  const submit = event => { event.preventDefault(); if (title.trim() && noteType) onCreate({ title: title.trim(), noteType }); };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="create-modal" onMouseDown={e => e.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}><X /></button><p className="eyebrow">NEW NOTE</p>{!noteType ? <><h2>Choose note type</h2><div className="note-type-options"><button onClick={() => setNoteType('simple')}><FileText /><strong>Simple Note</strong><span>Write any text or use voice</span></button><button onClick={() => setNoteType('spend')}><Calculator /><strong>Spend Note</strong><span>Items, prices and totals</span></button></div></> : <form onSubmit={submit}><button type="button" className="type-back" onClick={() => setNoteType(null)}>← Change type</button><h2>{noteType === 'simple' ? 'Simple Note' : 'Spend Note'} title</h2><input autoFocus placeholder="Enter note title" value={title} onChange={e => setTitle(e.target.value)} /><p>Today · {displayDate(new Date())}</p><button className="primary wide">Create note</button></form>}</div></div>;
}

function DeleteNoteModal({ note, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => { setDeleting(true); try { await onConfirm(); } finally { setDeleting(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}><section className="delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-note-title" onMouseDown={event => event.stopPropagation()}><p className="eyebrow">DELETE NOTE</p><h2 id="delete-note-title">Delete “{note.title}”?</h2><p>This note and all of its content will be permanently removed. This action cannot be undone.</p><div className="delete-modal-actions"><button className="secondary" onClick={onCancel} disabled={deleting}>Cancel</button><button className="delete-confirm" onClick={confirm} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete note'}</button></div></section></div>;
}

function Editor(props) {
  return (props.note.noteType || 'spend') === 'simple' ? <SimpleEditor {...props} /> : <SpendEditor {...props} />;
}

function SimpleEditor({ note, onSave, onDelete, onBack, online }) {
  const [draft, setDraft] = useState(note); const [message, setMessage] = useState(''); const [listening, setListening] = useState(false); const [language, setLanguage] = useState('en');
  const recognitionRef = useRef(null);
  useEffect(() => setDraft(note), [note.clientId]);
  useEffect(() => () => recognitionRef.current?.abort(), []);
  const update = patch => setDraft(current => { const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) }; void onSave(next); return next; });
  const voice = () => {
    if (listening) { recognitionRef.current?.abort(); recognitionRef.current = null; setListening(false); return setMessage('Voice recording cancelled.'); }
    if (!online) return setMessage('Network error: voice entry requires internet.');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return setMessage('Voice recognition is not supported. Please use Chrome.');
    const recognition = new Recognition(); recognition.lang = language === 'ur' ? 'ur-PK' : 'en-PK'; recognition.interimResults = false; recognitionRef.current = recognition;
    recognition.onstart = () => { setListening(true); setMessage('Listening…'); };
    recognition.onerror = event => { setListening(false); setMessage(event.error === 'network' ? 'Network error: voice entry requires internet.' : `Microphone error: ${event.error}`); };
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    recognition.onresult = event => { const text = event.results[0][0].transcript; const field = language === 'ur' ? 'contentUrdu' : 'content'; update(current => ({ [field]: `${current[field] || ''}${current[field] ? '\n' : ''}${text}` })); setMessage('Voice text added.'); };
    recognition.start();
  };
  const download = async () => { const element = document.getElementById(`simple-note-${draft.clientId}`); const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() }); const link = document.createElement('a'); link.download = `${draft.title.replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-') || 'note'}.png`; link.href = dataUrl; link.click(); };
  return <div className="editor"><div className="editor-toolbar"><button className="back" onClick={onBack}>← Notes</button><span>{displayDate(draft.noteDate)}</span><div className="note-actions"><div className="segmented"><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button><button className={language === 'ur' ? 'active' : ''} onClick={() => setLanguage('ur')}>اردو</button></div><button className="secondary icon-only" onClick={download}><Download size={18} /></button><button className="danger-icon" onClick={onDelete}><Trash2 size={18} /></button></div></div><div className="voice-bar voice-top"><button className={`mic ${listening ? 'listening' : ''}`} onClick={voice} title={listening ? 'Cancel voice recording' : 'Add with your voice'}>{listening ? <X /> : <Mic />}</button><div><strong>{listening ? 'Tap to cancel' : 'Add with your voice'}</strong><span>{message || 'Speak to append text'}</span></div></div><div className={`paper simple-paper ${language === 'ur' ? 'urdu-mode' : ''}`} id={`simple-note-${draft.clientId}`}><div className="paper-head"><input className="title-input" value={draft.title} onChange={e => update({ title: e.target.value })} /><p>{displayDate(draft.noteDate)}</p></div><textarea className={`simple-note-text ${language === 'ur' ? 'urdu' : ''}`} dir={language === 'ur' ? 'rtl' : 'ltr'} autoFocus placeholder={language === 'ur' ? 'یہاں کچھ بھی لکھیں…' : 'Write anything here…'} value={language === 'ur' ? (draft.contentUrdu || '') : (draft.content || '')} onChange={e => update(language === 'ur' ? { contentUrdu: e.target.value } : { content: e.target.value })} /></div></div>;
}

function SpendEditor({ note, onSave, onDelete, onBack, online }) {
  const [draft, setDraft] = useState(note); const [message, setMessage] = useState(''); const [listening, setListening] = useState(false); const [processing, setProcessing] = useState(false); const [language, setLanguage] = useState('en');
  const recognitionRef = useRef(null); const processingRef = useRef(null);
  useEffect(() => setDraft(note), [note.clientId]);
  useEffect(() => () => { recognitionRef.current?.abort(); processingRef.current?.abort(); }, []);
  const update = patch => setDraft(current => { const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) }; void onSave(next); return next; });
  const add = () => update(current => ({ items: [...current.items, { id: uid(), originalText: '', englishName: '', urduName: '', romanName: '', amount: '' }] }));
  const edit = (id, patch) => update(current => ({ items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) }));
  const removeItem = id => update(current => ({ items: current.items.filter(item => item.id !== id) }));
  const voice = () => {
    if (processing) { processingRef.current?.abort(); processingRef.current = null; setProcessing(false); return setMessage('Processing cancelled.'); }
    if (listening) { recognitionRef.current?.abort(); recognitionRef.current = null; setListening(false); return setMessage('Voice recording cancelled.'); }
    if (!online) return setMessage('Network error: voice entry requires internet.');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return setMessage('Voice recognition is not supported. Please use Chrome.');
    const recognition = new Recognition(); recognition.lang = language === 'ur' ? 'ur-PK' : 'en-PK'; recognition.interimResults = false; recognitionRef.current = recognition;
    recognition.onstart = () => { setListening(true); setMessage('Listening…'); };
    recognition.onerror = event => { setListening(false); setMessage(event.error === 'network' ? 'Network error: voice entry requires internet.' : `Microphone error: ${event.error}`); };
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    recognition.onresult = async event => { const transcript = event.results[0][0].transcript; const controller = new AbortController(); processingRef.current = controller; setProcessing(true); setMessage(`Heard: “${transcript}”`); try { const data = await api('/ai/parse', { method: 'POST', body: JSON.stringify({ transcript }), signal: controller.signal }); update(current => ({ items: [...current.items, ...data.items] })); setMessage('Voice item added.'); } catch (error) { setMessage(error.name === 'AbortError' ? 'Processing cancelled.' : error.message); } finally { if (processingRef.current === controller) { processingRef.current = null; setProcessing(false); } } };
    recognition.start();
  };
  const download = async () => {
    const element = document.getElementById(`note-${draft.clientId}`);
    const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() });
    const link = document.createElement('a'); link.download = `${draft.title.replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-') || 'note'}.png`; link.href = dataUrl; link.click();
  };
  const total = useMemo(() => draft.items.reduce((sum, item) => sum + Number(item.amount || 0), 0), [draft.items]);
  return <div className="editor"><div className="editor-toolbar"><button className="back" onClick={onBack}>← Notes</button><span>{displayDate(draft.noteDate)}</span><div className="note-actions"><div className="segmented"><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>{(language === 'en' || language === 'roman') && <button className={language === 'roman' ? 'active' : ''} onClick={() => setLanguage('roman')}>Roman Urdu</button>}<button className={language === 'ur' ? 'active' : ''} onClick={() => setLanguage('ur')}>اردو</button></div><button className="secondary icon-only" onClick={download} title="Download note"><Download size={18} /></button><button className="danger-icon" onClick={onDelete} title="Delete note"><Trash2 size={18} /></button></div></div><div className="voice-bar voice-top"><button className={`mic ${listening ? 'listening' : ''}`} onClick={voice} title={listening || processing ? 'Cancel' : 'Add with your voice'}>{listening || processing ? <X /> : <Mic />}</button><div><strong>{listening ? 'Tap to cancel recording' : processing ? 'Tap to cancel processing' : 'Add with your voice'}</strong><span>{message || 'Add with your voice'}</span></div></div><div className={`paper ${language === 'ur' ? 'urdu-mode' : ''}`} id={`note-${draft.clientId}`}><div className="paper-head"><input className="title-input" value={draft.title} onChange={e => update({ title: e.target.value })} /><p>{displayDate(draft.noteDate)}</p></div><div className={`items ${language === 'ur' ? 'items-urdu' : ''}`}><div className="item labels"><span>{language === 'ur' ? 'نوٹ / چیز' : 'NOTE / ITEM'}</span><span>{language === 'ur' ? 'رقم' : 'AMOUNT'}</span><i /></div>{draft.items.map((item, index) => <div className="item" key={item.id}><span><em>{index + 1}</em><input className={language === 'ur' ? 'urdu' : ''} dir={language === 'ur' ? 'rtl' : 'ltr'} placeholder={language === 'ur' ? 'نوٹ لکھیں…' : language === 'roman' ? 'Roman Urdu mein likhein…' : 'Write note or item…'} value={language === 'ur' ? item.urduName : language === 'roman' ? (item.romanName || item.originalText || '') : item.englishName} onChange={e => edit(item.id, language === 'ur' ? { urduName: e.target.value } : language === 'roman' ? { romanName: e.target.value } : { englishName: e.target.value })} /></span><span className="amount"><small>Rs</small><input type="number" min="0" placeholder="0" value={item.amount ?? ''} onChange={e => edit(item.id, { amount: e.target.value === '' ? '' : Number(e.target.value) })} /></span><button data-html2canvas-ignore="true" onClick={() => removeItem(item.id)}><Trash2 size={16} /></button></div>)}</div><button className="add-row" data-html2canvas-ignore="true" onClick={add}><Plus size={17} /> {language === 'ur' ? 'خود شامل کریں' : 'Add text manually'}</button><div className="total"><span>{language === 'ur' ? 'کل رقم' : 'Total'}</span><strong>{money(total)}</strong></div></div></div>;
}
