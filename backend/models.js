import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  originalText: { type: String, default: '' },
  englishName: { type: String, default: '', trim: true },
  urduName: { type: String, default: '', trim: true },
  romanName: { type: String, default: '', trim: true },
  amount: { type: Number, min: 0, default: null }
}, { _id: false });

const noteSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, required: true },
  noteType: { type: String, enum: ['simple', 'spend'], default: 'spend' },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  content: { type: String, default: '', maxlength: 50000 },
  contentUrdu: { type: String, default: '', maxlength: 50000 },
  items: { type: [itemSchema], default: [] },
  noteDate: { type: Date, default: Date.now }
}, { timestamps: true });
noteSchema.index({ owner: 1, clientId: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
