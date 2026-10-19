import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models.js';

let connectionPromise;
async function ensureDevelopmentAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) return;
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') { existing.role = 'admin'; await existing.save(); }
    return;
  }
  await User.create({ name: 'Administrator', email, role: 'admin', passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Development admin account created for ${email}`);
}

export function connectDb() {
  if (mongoose.connection.readyState === 1) {
    console.log('Database Connected');
    return Promise.resolve(mongoose.connection);
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured');
  connectionPromise ||= mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
    .then(async connection => {
      console.log('Database Connected');
      await ensureDevelopmentAdmin();
      return connection;
    })
    .catch(error => {
      connectionPromise = undefined;
      console.error('Database Connection Failed:', error.message);
      throw error;
    });
  return connectionPromise;
}
