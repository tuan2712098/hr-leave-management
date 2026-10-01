const express = require('express');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
}

function countWorkingDays(startDate, endDate) {
  let days = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const weekday = current.getUTCDay();

    if (weekday !== 0 && weekday !== 6) {
      days++;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

router.get('/me', async (req, res, next) => {
  try {
    const requests = await LeaveRequest.find({ user: req.user._id })
      .populate('leaveType', 'name code paid')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (!start || !end || end < start ||
        start.getUTCFullYear() !== end.getUTCFullYear()) {
      return res.status(400).json({
        message: 'Ngày nghỉ không hợp lệ. Một đơn phải nằm trong cùng một năm.',
      });
    }

    if (typeof reason !== 'string' ||
        reason.trim().length < 3 ||
        reason.trim().length > 1000) {
      return res.status(400).json({
        message: 'Lý do nghỉ phải có từ 3 đến 1000 ký tự',
      });
    }

    const mongoose = require('mongoose');

    if (!mongoose.isValidObjectId(leaveType)) {
      return res.status(400).json({ message: 'Loại nghỉ phép không hợp lệ' });
    }

    const type = await LeaveType.findById(leaveType);

    if (!type || type.status !== 'active') {
      return res.status(400).json({ message: 'Loại nghỉ phép không tồn tại hoặc đã khóa' });
    }

    const days = countWorkingDays(start, end);

    if (days < 1 || days > 366) {
      return res.status(400).json({
        message: 'Khoảng thời gian phải có ít nhất một ngày làm việc',
      });
    }

    const overlapping = await LeaveRequest.exists({
      user: req.user._id,
      status: { $in: ['pending', 'approved_by_manager', 'approved'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    if (overlapping) {
      return res.status(409).json({
        message: 'Bạn đã có đơn nghỉ phép trùng khoảng thời gian này',
      });
    }

    const year = start.getUTCFullYear();

    if (type.paid) {
      const balance = await LeaveBalance.findOne({
        user: req.user._id,
        leaveType: type._id,
        year,
      });

      if (!balance) {
        return res.status(400).json({
          message: 'Bạn chưa được cấp số ngày phép cho loại này',
        });
      }

      const remaining = balance.allocatedDays +
        balance.carriedOverDays - balance.usedDays;

      if (days > remaining) {
        return res.status(400).json({
          message: `Không đủ ngày phép. Còn ${remaining} ngày.`,
        });
      }
    }

    const request = await LeaveRequest.create({
      user: req.user._id,
      leaveType: type._id,
      startDate: start,
      endDate: end,
      year,
      days,
      reason: reason.trim(),
      history: [{
        actor: req.user._id,
        action: 'submitted',
      }],
    });

    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/cancel', async (req, res, next) => {
  try {
    if (!require('mongoose').isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID đơn không hợp lệ' });
    }

    const cancelled = await LeaveRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        status: 'pending',
      },
      {
        $set: { status: 'cancelled' },
        $push: {
          history: {
            actor: req.user._id,
            action: 'cancelled',
            note: 'Nhân viên hủy đơn',
          },
        },
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!cancelled) {
      const existing = await LeaveRequest.exists({
        _id: req.params.id,
        user: req.user._id,
      });

      return res.status(existing ? 409 : 404).json({
        message: existing
          ? 'Chỉ có thể hủy đơn đang chờ Manager duyệt'
          : 'Không tìm thấy đơn nghỉ phép',
      });
    }

    return res.json(cancelled);
  } catch (error) {
    next(error);
  }
});
module.exports = router;