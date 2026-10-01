require('dotenv').config();

const mongoose = require('mongoose');
const User = require('./models/User');
const Department = require('./models/Department');
const LeaveType = require('./models/LeaveType');
const LeaveBalance = require('./models/LeaveBalance');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Khong chay du lieu demo tren production');
  }

  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hr_leave_management'
  );

  const manager = await User.findOne({ email: 'manager@hr.local' });
  const employee = await User.findOne({ email: 'employee@hr.local' });

  if (!manager || !employee ||
      manager.role !== 'manager' ||
      employee.role !== 'employee') {
    throw new Error('Khong tim thay tai khoan demo dung vai tro');
  }

  let department = await Department.findOne({ code: 'DEMO_TEAM' });

  if (!department) {
    department = await Department.create({
      name: 'Phòng ban Demo',
      code: 'DEMO_TEAM',
      manager: manager._id,
    });
  } else if (String(department.manager) !== String(manager._id)) {
    throw new Error('Phong ban demo da co nguoi quan ly khac');
  }

  manager.department = department._id;
  await manager.save();

  employee.department = department._id;
  employee.manager = manager._id;
  await employee.save();

  let leaveType = await LeaveType.findOne({ code: 'ANNUAL_DEMO' });

  if (!leaveType) {
    leaveType = await LeaveType.create({
      name: 'Nghỉ phép năm',
      code: 'ANNUAL_DEMO',
      defaultDays: 12,
      paid: true,
    });
  }

  if (!leaveType.paid || leaveType.status !== 'active') {
    throw new Error('Loai nghi phep demo khong hop le');
  }

  const year = new Date().getFullYear();

  const balance = await LeaveBalance.findOneAndUpdate(
    {
      user: employee._id,
      leaveType: leaveType._id,
      year,
    },
    {
      $setOnInsert: {
        allocatedDays: 12,
        carriedOverDays: 0,
        usedDays: 0,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log('DA THIET LAP DU LIEU DEMO HR');
  console.log('Phong ban:', department.name);
  console.log('Manager:', manager.email);
  console.log('Nhan vien:', employee.email);
  console.log('Loai phep:', leaveType.name);
  console.log('Nam:', balance.year);
  console.log('Ngay phep con lai:', balance.remainingDays);
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());