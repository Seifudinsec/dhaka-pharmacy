require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const User = require(path.join(__dirname, '..', 'models', 'User'));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const idsToDelete = [
    '6a343fb4aa8a83566205f5f1',
    '6a3444eeb41eac857f0c7639',
  ];
  const result = await User.deleteMany({ _id: { $in: idsToDelete } });
  console.log(JSON.stringify({ deleted: result.deletedCount }, null, 2));

  const remaining = await User.find({}, 'username role isMainAdmin').sort({ createdAt: -1 });
  console.log('Remaining users:', JSON.stringify(remaining, null, 2));

  await mongoose.disconnect();
})();
