const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await mongoose.connection.db.collection('users').updateMany(
    {},
    { $set: { role: 'main_admin', isMainAdmin: true } }
  );
  console.log(`Updated ${result.modifiedCount} user(s) to main_admin`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
