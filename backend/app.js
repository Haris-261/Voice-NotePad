import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { connectDb } from './db.js';
import { Note, User } from './models.js';
import { requireAdmin, requireAuth, signToken } from './auth.js';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.get('/api/health', (req, res) => res.json({ ok: true, databaseConfigured: Boolean(process.env.MONGODB_URI), geminiConfigured: Boolean(process.env.GEMINI_API_KEY) }));
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  try { await connectDb(); next(); } catch (error) { res.status(503).json({ message: 'Database unavailable', detail: process.env.NODE_ENV === 'development' ? error.message : undefined }); }
});

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });

app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ message: 'Name must be at least 2 characters' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'Email is already registered' });
    const role = email === normalizeEmail(process.env.ADMIN_EMAIL) ? 'admin' : 'user';
    const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'Email is already registered' });
    res.status(500).json({ message: 'Could not create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ message: 'Incorrect email or password' });
  if (email === normalizeEmail(process.env.ADMIN_EMAIL) && user.role !== 'admin') { user.role = 'admin'; await user.save(); }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/notes', requireAuth, async (req, res) => {
  const notes = await Note.find({ owner: req.user.id }).sort({ updatedAt: -1 }).lean();
  res.json({ notes });
});

app.put('/api/notes/:clientId', requireAuth, async (req, res) => {
  const { title, items = [], noteDate, noteType = 'spend', content = '', contentUrdu = '' } = req.body;
  if (!String(title || '').trim()) return res.status(400).json({ message: 'Title is required' });
  const safeItems = items.slice(0, 250).map(item => ({
    id: String(item.id || crypto.randomUUID()), originalText: String(item.originalText || ''),
    englishName: String(item.englishName || '').trim(), urduName: String(item.urduName || '').trim(), romanName: String(item.romanName || item.originalText || '').trim(),
    amount: item.amount === '' || item.amount == null ? null : Number(item.amount)
  })).filter(item => item.amount === null || (Number.isFinite(item.amount) && item.amount >= 0));
  const note = await Note.findOneAndUpdate(
    { owner: req.user.id, clientId: req.params.clientId },
    { title: String(title).trim(), noteType: noteType === 'simple' ? 'simple' : 'spend', content: String(content).slice(0, 50000), contentUrdu: String(contentUrdu).slice(0, 50000), items: noteType === 'simple' ? [] : safeItems, noteDate: noteDate || new Date() },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ note });
});

app.delete('/api/notes/:clientId', requireAuth, async (req, res) => {
  await Note.deleteOne({ owner: req.user.id, clientId: req.params.clientId });
  res.status(204).end();
});

app.post('/api/ai/parse', requireAuth, async (req, res) => {
  const transcript = String(req.body.transcript || '').trim().slice(0, 2000);
  if (!transcript) return res.status(400).json({ message: 'Transcript is required' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ message: 'Gemini is not configured' });
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const schema = { type: 'ARRAY', items: { type: 'OBJECT', required: ['englishName', 'urduName', 'romanName', 'amount'], properties: {
    originalText: { type: 'STRING' }, englishName: { type: 'STRING' }, urduName: { type: 'STRING' }, romanName: { type: 'STRING' }, amount: { type: 'NUMBER' }
  } } };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: `Extract expense entries and their amounts from mixed Urdu, Roman Urdu, or English. Preserve the complete meaningful description and remove only the numeric amount and currency words. Return natural English, Urdu script, and Roman Urdu descriptions. Example: "Haris ko 2000 kharcha diya" becomes englishName "Gave expense money to Haris", urduName "حارث کو خرچہ دیا", romanName "Haris ko kharcha diya", amount 2000. Example: "500 ki sabzi" becomes englishName "Vegetables", urduName "سبزی", romanName "Sabzi", amount 500. Input: ${transcript}` }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 } })
  });
  if (!response.ok) {
    const upstream = await response.json().catch(() => ({}));
    const detail = upstream?.error?.message || `Gemini returned HTTP ${response.status}`;
    console.error('Gemini API error:', detail);
    return res.status(502).json({ message: 'AI processing failed', detail });
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    const items = JSON.parse(text).map(item => ({ ...item, id: crypto.randomUUID(), originalText: item.originalText || transcript, amount: Number(item.amount) })).filter(item => item.englishName && item.urduName && Number.isFinite(item.amount));
    res.json({ items });
  } catch { res.status(502).json({ message: 'AI returned an unexpected response' }); }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  const counts = await Note.aggregate([{ $group: { _id: '$owner', noteCount: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map(row => [String(row._id), row.noteCount]));
  res.json({ users: users.map(user => ({ ...user, noteCount: countMap[String(user._id)] || 0 })) });
});

app.get('/api/admin/notes', requireAuth, requireAdmin, async (req, res) => {
  const notes = await Note.find().populate('owner', 'name email').sort({ updatedAt: -1 }).lean();
  res.json({ notes });
});

app.patch('/api/admin/password', requireAuth, requireAdmin, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
  const admin = await User.findById(req.user.id);
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) return res.status(400).json({ message: 'Current password is incorrect' });
  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  await admin.save();
  res.json({ message: 'Password changed successfully' });
});

app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));
export default app;
