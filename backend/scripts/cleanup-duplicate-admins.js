require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const User = require(path.join(__dirname, '..', 'models', 'User'));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await User.deleteMany({
    _id: { $ne: '6a34d862e49be028ae3efe5e' },
  });
  console.log(JSON.stringify({ deleted: result.deletedCount }, null, 2));

  const remaining = await User.find({}, 'username role isMainAdmin').sort({ createdAt: -1 });
  console.log('Remaining users:', JSON.stringify(remaining, null, 2));

  await mongoose.disconnect();
})();
