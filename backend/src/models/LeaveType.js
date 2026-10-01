const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  defaultDays: { type: Number, required: true, min: 0, max: 366 },
  paid: { type: Boolean, default: true },
  requiresDocument: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);