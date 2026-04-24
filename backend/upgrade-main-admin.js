require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const targetUsername = process.argv[2] || 'admin';

async function upgradeUser() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is not defined in .env file');
      process.exit(1);
    }

    console.log(`Connecting to database...`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    console.log(`\nLooking for user: "${targetUsername}"...`);
    const user = await User.findOne({ username: targetUsername.toLowerCase() });

    if (!user) {
      console.error(`\n❌ Error: User "${targetUsername}" not found in the database.`);
      console.log('You can specify a different username by running: node upgrade-main-admin.js <username>');
      process.exit(1);
    }

    if (user.role === 'main_admin') {
      console.log(`\n✅ User "${targetUsername}" is already a main_admin!`);
      process.exit(0);
    }

    // Perform upgrade
    user.role = 'main_admin';
    await user.save();

    console.log(`\n🎉 SUCCESS! User "${targetUsername}" has been upgraded to main_admin.`);
    console.log('You can now log in and access all Main Admin privileges.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ An error occurred:', error);
    process.exit(1);
  }
}

upgradeUser();
