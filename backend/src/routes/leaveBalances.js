const express = require('express');
const mongoose = require('mongoose');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveType = require('../models/LeaveType');
const User = require('../models/User');
const { requireAuth, allowRoles } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

function validDays(value) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 366;
}

router.get('/me', async (req, res, next) => {
  try {
    const year = Number(req.query.year ?? new Date().getFullYear());

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Năm không hợp lệ' });
    }

    const balances = await LeaveBalance.find({
      user: req.user._id,
      year,
    }).populate('leaveType', 'name code paid');

    res.json(balances);
  } catch (error) {
    next(error);
  }
});

router.get('/', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.user) {
      if (!mongoose.isValidObjectId(req.query.user)) {
        return res.status(400).json({ message: 'ID nhân viên không hợp lệ' });
      }
      filter.user = req.query.user;
    }

    if (req.query.year !== undefined) {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ message: 'Năm không hợp lệ' });
      }
      filter.year = year;
    }

    const balances = await LeaveBalance.find(filter)
      .populate('user', 'fullName email role')
      .populate('leaveType', 'name code')
      .sort({ year: -1 });

    res.json(balances);
  } catch (error) {
    next(error);
  }
});

router.post('/', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    const { user, leaveType, year, allocatedDays, carriedOverDays = 0 } = req.body;

    if (!mongoose.isValidObjectId(user) ||
        !mongoose.isValidObjectId(leaveType) ||
        !Number.isInteger(year) || year < 2000 || year > 2100 ||
        !validDays(carriedOverDays)) {
      return res.status(400).json({ message: 'Dữ liệu cấp phép không hợp lệ' });
    }

    const employee = await User.findById(user);
    const type = await LeaveType.findById(leaveType);

    if (!employee || employee.status !== 'active' ||
        !type || type.status !== 'active') {
      return res.status(400).json({ message: 'Nhân viên hoặc loại phép không hợp lệ' });
    }

    const days = allocatedDays ?? type.defaultDays;

    if (!validDays(days)) {
      return res.status(400).json({ message: 'Số ngày phép không hợp lệ' });
    }

    const balance = await LeaveBalance.create({
      user,
      leaveType,
      year,
      allocatedDays: days,
      carriedOverDays,
    });

    res.status(201).json(balance);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Nhân viên đã được cấp loại phép này trong năm',
      });
    }
    next(error);
  }
});

router.patch('/:id', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const balance = await LeaveBalance.findById(req.params.id);

    if (!balance) {
      return res.status(404).json({ message: 'Không tìm thấy số dư ngày phép' });
    }

    const allocatedDays = req.body.allocatedDays ?? balance.allocatedDays;
    const carriedOverDays = req.body.carriedOverDays ?? balance.carriedOverDays;

    if (!validDays(allocatedDays) || !validDays(carriedOverDays)) {
      return res.status(400).json({ message: 'Số ngày phép không hợp lệ' });
    }

    if (allocatedDays + carriedOverDays < balance.usedDays) {
      return res.status(400).json({
        message: 'Không thể giảm số ngày phép thấp hơn số ngày đã sử dụng',
      });
    }

    balance.allocatedDays = allocatedDays;
    balance.carriedOverDays = carriedOverDays;

    await balance.save();
    res.json(balance);
  } catch (error) {
    next(error);
  }
});

module.exports = router;