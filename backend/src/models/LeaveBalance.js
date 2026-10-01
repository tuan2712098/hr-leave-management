const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  year: { type: Number, required: true, min: 2000, max: 2100 },
  allocatedDays: { type: Number, required: true, min: 0, max: 366 },
  carriedOverDays: { type: Number, default: 0, min: 0, max: 366 },
  usedDays: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

leaveBalanceSchema.index(
  { user: 1, leaveType: 1, year: 1 },
  { unique: true }
);

leaveBalanceSchema.virtual('remainingDays').get(function () {
  return this.allocatedDays + this.carriedOverDays - this.usedDays;
});

leaveBalanceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);