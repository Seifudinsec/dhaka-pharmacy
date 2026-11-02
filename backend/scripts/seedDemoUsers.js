const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const demoAccounts = [
  { username: "demo-admin", password: "DemoAdmin2026!", role: "admin" },
  {
    username: "demo-pharmacist",
    password: "DemoPharmacy2026!",
    role: "pharmacist",
  },
];

const seedDemoUsers = async () => {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("Set DEMO_MODE=true to seed public demo accounts.");
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existingUsers = await User.find({
    username: { $in: demoAccounts.map(({ username }) => username) },
  }).select("username");
  if (existingUsers.length) {
    throw new Error(
      `Demo usernames already exist (${existingUsers
        .map(({ username }) => username)
        .join(", ")}); no accounts were changed.`,
    );
  }

  const users = await Promise.all(
    demoAccounts.map(async ({ username, password, role }) => ({
      username,
      password: await bcrypt.hash(password, 12),
      role,
    })),
  );
  await User.create(users);
  console.log("Created demo-admin and demo-pharmacist accounts.");
};

seedDemoUsers()
  .catch((error) => {
    console.error("Demo account setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
