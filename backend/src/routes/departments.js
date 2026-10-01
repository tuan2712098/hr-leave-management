const express = require('express');
const mongoose = require('mongoose');
const Department = require('../models/Department');
const User = require('../models/User');
const { requireAuth, allowRoles } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const departments = await Department.find()
      .populate('manager', 'fullName email role')
      .sort({ name: 1 });

    res.json(departments);
  } catch (error) {
    next(error);
  }
});

router.post('/', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    const { name, code, manager } = req.body;

    if (typeof name !== 'string' || !name.trim() ||
        typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ message: 'Tên và mã phòng ban là bắt buộc' });
    }

    if (manager) {
      if (!mongoose.isValidObjectId(manager)) {
        return res.status(400).json({ message: 'Mã quản lý không hợp lệ' });
      }

      const user = await User.findById(manager);
      if (!user || user.role !== 'manager' || user.status !== 'active') {
        return res.status(400).json({ message: 'Người quản lý không hợp lệ' });
      }
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      manager: manager || null,
    });

    res.status(201).json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Mã phòng ban đã tồn tại' });
    }
    next(error);
  }
});

router.patch('/:id', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID phòng ban không hợp lệ' });
    }

    const changes = {};
    const { name, code, manager, status } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Tên phòng ban không hợp lệ' });
      }
      changes.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ message: 'Mã phòng ban không hợp lệ' });
      }
      changes.code = code.trim().toUpperCase();
    }

    if (manager !== undefined) {
      if (manager !== null) {
        if (!mongoose.isValidObjectId(manager)) {
          return res.status(400).json({ message: 'Mã quản lý không hợp lệ' });
        }

        const user = await User.findById(manager);
        if (!user || user.role !== 'manager' || user.status !== 'active') {
          return res.status(400).json({ message: 'Người quản lý không hợp lệ' });
        }
      }
      changes.manager = manager;
    }

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }
      changes.status = status;
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: changes },
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({ message: 'Không tìm thấy phòng ban' });
    }

    res.json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Mã phòng ban đã tồn tại' });
    }
    next(error);
  }
});

module.exports = router;