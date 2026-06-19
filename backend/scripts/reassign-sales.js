require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const User = require(path.join(__dirname, '..', 'models', 'User'));
const Sale = require(path.join(__dirname, '..', 'models', 'Sale'));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const oldAdminId = '6a343fb4aa8a83566205f5f1';
  const newAdminId = '6a34d862e49be028ae3efe5e';

  const res = await Sale.updateMany(
    { servedBy: oldAdminId },
    { $set: { servedBy: newAdminId } }
  );
  console.log(JSON.stringify({ matched: res.matchedCount, modified: res.modifiedCount }, null, 2));

  await mongoose.disconnect();
})();
