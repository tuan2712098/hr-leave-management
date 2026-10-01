const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  year: { type: Number, required: true },
  days: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: {
    type: String,
    enum: ['pending', 'approved_by_manager', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
  },
  history: [{
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

leaveRequestSchema.index({ user: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);