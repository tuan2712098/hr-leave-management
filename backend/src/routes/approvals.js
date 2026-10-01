const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const { requireAuth, allowRoles } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

async function getTeamIds(managerId) {
  const departments = await Department.find({
    manager: managerId,
    status: 'active',
  }).select('_id');

  const users = await User.find({
    status: 'active',
    role: { $in: ['employee', 'manager'] },
    _id: { $ne: managerId },
    $or: [
      { manager: managerId },
      { department: { $in: departments.map(dept => dept._id) } },
    ],
  }).select('_id');

  return users.map(user => user._id);
}

function readDecision(body) {
  const decision = body?.decision;
  const note = body?.note ?? '';

  if (!['approve', 'reject'].includes(decision) ||
      typeof note !== 'string' ||
      note.length > 500 ||
      (decision === 'reject' && !note.trim())) {
    return null;
  }

  return { decision, note: note.trim() };
}

router.get('/team', allowRoles('manager'), async (req, res, next) => {
  try {
    const teamIds = await getTeamIds(req.user._id);

    const requests = await LeaveRequest.find({
      user: { $in: teamIds },
      status: 'pending',
    })
      .populate('user', 'fullName email department')
      .populate('leaveType', 'name code')
      .sort({ createdAt: 1 });

    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.get('/hr', allowRoles('hr_admin', 'super_admin'), async (_req, res, next) => {
  try {
    const requests = await LeaveRequest.find({
      status: 'approved_by_manager',
    })
      .populate('user', 'fullName email department')
      .populate('leaveType', 'name code paid')
      .sort({ createdAt: 1 });

    res.json(requests);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/manager', allowRoles('manager'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID đơn không hợp lệ' });
    }

    const input = readDecision(req.body);

    if (!input) {
      return res.status(400).json({
        message: 'Quyết định hoặc ghi chú không hợp lệ. Từ chối phải có lý do.',
      });
    }

    const teamIds = await getTeamIds(req.user._id);

    const request = await LeaveRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        user: { $in: teamIds },
        status: 'pending',
      },
      {
        $set: {
          status: input.decision === 'approve'
            ? 'approved_by_manager'
            : 'rejected',
        },
        $push: {
          history: {
            actor: req.user._id,
            action: input.decision === 'approve'
              ? 'manager_approved'
              : 'manager_rejected',
            note: input.note,
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({
        message: 'Không tìm thấy đơn đang chờ bạn duyệt',
      });
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/hr', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID đơn không hợp lệ' });
    }

    const input = readDecision(req.body);

    if (!input) {
      return res.status(400).json({
        message: 'Quyết định hoặc ghi chú không hợp lệ. Từ chối phải có lý do.',
      });
    }

    const request = await LeaveRequest.findOne({
      _id: req.params.id,
      status: 'approved_by_manager',
    });

    if (!request) {
      return res.status(404).json({
        message: 'Không tìm thấy đơn đang chờ HR duyệt',
      });
    }

    if (String(request.user) === String(req.user._id)) {
      return res.status(403).json({
        message: 'Bạn không thể tự duyệt đơn của mình',
      });
    }

    const nextStatus = input.decision === 'approve' ? 'approved' : 'rejected';

    if (input.decision === 'reject') {
      const rejected = await LeaveRequest.findOneAndUpdate(
        { _id: request._id, status: 'approved_by_manager' },
        {
          $set: { status: nextStatus },
          $push: {
            history: {
              actor: req.user._id,
              action: 'hr_rejected',
              note: input.note,
            },
          },
        },
        { new: true, runValidators: true }
      );

      if (!rejected) {
        return res.status(409).json({ message: 'Đơn đã được xử lý' });
      }

      return res.json(rejected);
    }

    const employee = await User.findOne({
      _id: request.user,
      status: 'active',
    });

    if (!employee) {
      return res.status(400).json({
        message: 'Tài khoản người xin nghỉ không còn hoạt động',
      });
    }

    const leaveType = await LeaveType.findById(request.leaveType);

    if (!leaveType) {
      return res.status(400).json({
        message: 'Loại nghỉ phép không còn tồn tại',
      });
    }

    let reservedBalance = null;

    if (leaveType.paid) {
      reservedBalance = await LeaveBalance.findOneAndUpdate(
        {
          user: request.user,
          leaveType: request.leaveType,
          year: request.year,
          $expr: {
            $gte: [
              {
                $subtract: [
                  { $add: ['$allocatedDays', '$carriedOverDays'] },
                  '$usedDays',
                ],
              },
              request.days,
            ],
          },
        },
        { $inc: { usedDays: request.days } },
        { new: true }
      );

      if (!reservedBalance) {
        return res.status(400).json({
          message: 'Không đủ ngày phép còn lại để duyệt đơn',
        });
      }
    }

    let approved;

    try {
      approved = await LeaveRequest.findOneAndUpdate(
        { _id: request._id, status: 'approved_by_manager' },
        {
          $set: { status: 'approved' },
          $push: {
            history: {
              actor: req.user._id,
              action: 'hr_approved',
              note: input.note,
            },
          },
        },
        { new: true, runValidators: true }
      );
    } catch (error) {
      if (reservedBalance) {
        await LeaveBalance.updateOne(
          { _id: reservedBalance._id },
          { $inc: { usedDays: -request.days } }
        );
      }
      throw error;
    }

    if (!approved) {
      if (reservedBalance) {
        await LeaveBalance.updateOne(
          { _id: reservedBalance._id },
          { $inc: { usedDays: -request.days } }
        );
      }

      return res.status(409).json({ message: 'Đơn đã được xử lý' });
    }

    res.json(approved);
  } catch (error) {
    next(error);
  }
});

module.exports = router;