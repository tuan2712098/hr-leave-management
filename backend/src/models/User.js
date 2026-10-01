const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['employee', 'manager', 'hr_admin', 'super_admin'],
    default: 'employee',
  },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  phone: { type: String, default: '' },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);