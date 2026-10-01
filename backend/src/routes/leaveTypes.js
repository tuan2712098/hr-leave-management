const express = require('express');
const mongoose = require('mongoose');
const LeaveType = require('../models/LeaveType');
const { requireAuth, allowRoles } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const types = await LeaveType.find().sort({ name: 1 });
    res.json(types);
  } catch (error) {
    next(error);
  }
});

router.post('/', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    const { name, code, defaultDays, paid, requiresDocument } = req.body;

    if (typeof name !== 'string' || !name.trim() ||
        typeof code !== 'string' || !code.trim() ||
        !Number.isInteger(defaultDays) || defaultDays < 0 || defaultDays > 366) {
      return res.status(400).json({
        message: 'Tên, mã và số ngày phép mặc định không hợp lệ',
      });
    }

    if (paid !== undefined && typeof paid !== 'boolean') {
      return res.status(400).json({ message: 'paid phải là true hoặc false' });
    }

    if (requiresDocument !== undefined && typeof requiresDocument !== 'boolean') {
      return res.status(400).json({ message: 'requiresDocument phải là true hoặc false' });
    }

    const type = await LeaveType.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      defaultDays,
      paid: paid ?? true,
      requiresDocument: requiresDocument ?? false,
    });

    res.status(201).json(type);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Mã loại nghỉ phép đã tồn tại' });
    }
    next(error);
  }
});

router.patch('/:id', allowRoles('hr_admin', 'super_admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const changes = {};
    const { name, code, defaultDays, paid, requiresDocument, status } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Tên không hợp lệ' });
      }
      changes.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ message: 'Mã không hợp lệ' });
      }
      changes.code = code.trim().toUpperCase();
    }

    if (defaultDays !== undefined) {
      if (!Number.isInteger(defaultDays) || defaultDays < 0 || defaultDays > 366) {
        return res.status(400).json({ message: 'Số ngày phép không hợp lệ' });
      }
      changes.defaultDays = defaultDays;
    }

    if (paid !== undefined) {
      if (typeof paid !== 'boolean') {
        return res.status(400).json({ message: 'paid không hợp lệ' });
      }
      changes.paid = paid;
    }

    if (requiresDocument !== undefined) {
      if (typeof requiresDocument !== 'boolean') {
        return res.status(400).json({ message: 'requiresDocument không hợp lệ' });
      }
      changes.requiresDocument = requiresDocument;
    }

    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }
      changes.status = status;
    }

    const type = await LeaveType.findByIdAndUpdate(
      req.params.id,
      { $set: changes },
      { new: true, runValidators: true }
    );

    if (!type) {
      return res.status(404).json({ message: 'Không tìm thấy loại nghỉ phép' });
    }

    res.json(type);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Mã loại nghỉ phép đã tồn tại' });
    }
    next(error);
  }
});

module.exports = router;