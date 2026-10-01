require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('./models/User');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Khong duoc seed tai khoan demo tren production');
  }

  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hr_leave_management'
  );

  const accounts = [
    { fullName: 'System Admin', email: 'admin@hr.local', role: 'super_admin' },
    { fullName: 'HR Admin', email: 'hr@hr.local', role: 'hr_admin' },
    { fullName: 'Team Manager', email: 'manager@hr.local', role: 'manager' },
    { fullName: 'Demo Employee', email: 'employee@hr.local', role: 'employee' },
  ];

  const existing = await User.countDocuments({
    email: { $in: accounts.map(account => account.email) },
  });

  if (existing > 0) {
    throw new Error('Da co tai khoan demo. Khong tao lai de tranh trung du lieu.');
  }

  const password = crypto.randomBytes(18).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);

  await User.insertMany(
    accounts.map(account => ({ ...account, passwordHash }))
  );

  console.log('DA TAO 4 TAI KHOAN DEMO:');
  accounts.forEach(account => console.log(`${account.role}: ${account.email}`));
  console.log(`MAT KHAU DEMO: ${password}`);
  console.log('Chi dung tai khoan demo cho moi truong phat trien.');
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());