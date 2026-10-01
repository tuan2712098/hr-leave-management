const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Department = require('../models/Department');
const { requireAuth, allowRoles } = require('../middlewares/auth');

const router = express.Router();
const roles = ['employee', 'manager', 'hr_admin', 'super_admin'];

router.use(requireAuth);

function publicUser(user) {
  const data = user.toObject();
  delete data.passwordHash;
  return data;
}

function canManage(actor, targetRole) {
  return actor.role === 'super_admin' ||
    (actor.role === 'hr_admin' &&
      ['employee', 'manager'].includes(targetRole));
}

async function validateAssignment(department, manager) {
  if (department) {
    if (!mongoose.isValidObjectId(department) ||
        !await Department.exists({ _id: department, status: 'active' })) {
      return 'Phòng ban không hợp lệ';
    }
  }

  if (manager) {
    if (!mongoose.isValidObjectId(manager) ||
        !await User.exists({
          _id: manager,
          role: 'manager',
          status: 'active',
        })) {
      return 'Người quản lý không hợp lệ';
    }
  }

  return null;
}

router.get('/me', (req, res) => {
  res.json(publicUser(req.user));
});

router.patch('/me', async (req, res, next) => {
  try {
    const { fullName, phone } = req.body || {};

    if (fullName !== undefined) {
      if (typeof fullName !== 'string' ||
          fullName.trim().length < 2 ||
          fullName.trim().length > 100) {
        return res.status(400).json({ message: 'Họ tên không hợp lệ' });
      }

      req.user.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string' || phone.length > 20) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
      }

      req.user.phone = phone.trim();
    }

    await req.user.save();
    res.json(publicUser(req.user));
  } catch (error) {
    next(error);
  }
});

router.get(
  '/',
  allowRoles('hr_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = 20;
      const filter = {};

      if (req.user.role === 'hr_admin') {
        filter.role = { $in: ['employee', 'manager'] };
      }

      if (typeof req.query.search === 'string' && req.query.search.trim()) {
        const escaped = req.query.search.trim()
          .slice(0, 100)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        filter.$or = [
          { fullName: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
        ];
      }

      const [items, total] = await Promise.all([
        User.find(filter)
          .populate('department', 'name code')
          .populate('manager', 'fullName email')
          .sort({ createdAt: -1 })
          .skip((Math.min(page, 10000) - 1) * limit)
          .limit(limit),
        User.countDocuments(filter),
      ]);

      res.json({ items, total, page, limit });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  allowRoles('hr_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const {
        fullName, email, role = 'employee',
        department = null, manager = null, phone = '',
      } = req.body || {};

      if (typeof fullName !== 'string' ||
          fullName.trim().length < 2 ||
          fullName.trim().length > 100 ||
          typeof email !== 'string' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          email.length > 254 ||
          !roles.includes(role) ||
          !canManage(req.user, role)) {
        return res.status(400).json({
          message: 'Thông tin nhân viên hoặc vai trò không hợp lệ',
        });
      }

      if (typeof phone !== 'string' || phone.length > 20) {
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
      }

      const assignmentError = await validateAssignment(department, manager);

      if (assignmentError) {
        return res.status(400).json({ message: assignmentError });
      }

      const temporaryPassword = crypto.randomBytes(15).toString('base64url');
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      const user = await User.create({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        department,
        manager,
        phone: phone.trim(),
        passwordHash,
      });

      res.status(201).json({
        user: publicUser(user),
        temporaryPassword,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
      next(error);
    }
  }
);

router.patch(
  '/:id',
  allowRoles('hr_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
      }

      if (!canManage(req.user, user.role)) {
        return res.status(403).json({ message: 'Không có quyền sửa tài khoản này' });
      }

      const {
        fullName, phone, role, department, manager, status,
      } = req.body || {};

      if (role !== undefined) {
        if (!roles.includes(role) ||
            !canManage(req.user, role) ||
            String(user._id) === String(req.user._id)) {
          return res.status(400).json({ message: 'Không thể thay đổi vai trò này' });
        }

        user.role = role;
      }

      if (fullName !== undefined) {
        if (typeof fullName !== 'string' ||
            fullName.trim().length < 2 ||
            fullName.trim().length > 100) {
          return res.status(400).json({ message: 'Họ tên không hợp lệ' });
        }

        user.fullName = fullName.trim();
      }

      if (phone !== undefined) {
        if (typeof phone !== 'string' || phone.length > 20) {
          return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
        }

        user.phone = phone.trim();
      }

      if (department !== undefined || manager !== undefined) {
        const error = await validateAssignment(
          department === undefined ? user.department : department,
          manager === undefined ? user.manager : manager
        );

        if (error) {
          return res.status(400).json({ message: error });
        }

        if (department !== undefined) user.department = department;
        if (manager !== undefined) user.manager = manager;
      }

      if (status !== undefined) {
        if (!['active', 'inactive'].includes(status) ||
            String(user._id) === String(req.user._id)) {
          return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
        }

        user.status = status;
      }

      await user.save();
      res.json(publicUser(user));
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: 'Dữ liệu đã tồn tại' });
      }
      next(error);
    }
  }
);

module.exports = router;