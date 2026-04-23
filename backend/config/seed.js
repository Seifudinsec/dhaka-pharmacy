const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Medicine = require('../models/Medicine');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
};

const seedData = async () => {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Medicine.deleteMany({});

  // Create admin user
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash('admin123', salt);
  await User.create({
    username: 'admin',
    password: hashedPassword,
    role: 'admin',
  });
  console.log('✅ Admin user created: admin / admin123');

  // Create sample medicines
  const medicines = [
    { name: 'Paracetamol 500mg', price: 5.50, buyingPrice: 4.20, batchNumber: 'BT-1001', stock: 150, expiryDate: new Date('2026-06-30') },
    { name: 'Amoxicillin 250mg', price: 12.00, buyingPrice: 8.70, batchNumber: 'BT-1002', stock: 80, expiryDate: new Date('2025-12-31') },
    { name: 'Ibuprofen 400mg', price: 8.75, buyingPrice: 6.10, batchNumber: 'BT-1003', stock: 5, expiryDate: new Date('2026-03-15') },
    { name: 'Metformin 500mg', price: 15.00, buyingPrice: 11.30, batchNumber: 'BT-1004', stock: 200, expiryDate: new Date('2025-08-20') },
    { name: 'Omeprazole 20mg', price: 9.25, buyingPrice: 7.00, batchNumber: 'BT-1005', stock: 3, expiryDate: new Date('2026-09-10') },
    { name: 'Atorvastatin 10mg', price: 22.00, buyingPrice: 16.00, batchNumber: 'BT-1006', stock: 60, expiryDate: new Date('2024-01-01') },
    { name: 'Losartan 50mg', price: 18.50, buyingPrice: 13.25, batchNumber: 'BT-1007', stock: 45, expiryDate: new Date('2026-11-30') },
    { name: 'Ciprofloxacin 500mg', price: 25.00, buyingPrice: 18.40, batchNumber: 'BT-1008', stock: 7, expiryDate: new Date('2026-04-15') },
    { name: 'Azithromycin 250mg', price: 30.00, buyingPrice: 21.00, batchNumber: 'BT-1009', stock: 120, expiryDate: new Date('2026-07-22') },
    { name: 'Doxycycline 100mg', price: 14.00, buyingPrice: 10.60, batchNumber: 'BT-1010', stock: 0, expiryDate: new Date('2025-05-10') },
  ];
  await Medicine.insertMany(medicines);
  console.log(`✅ ${medicines.length} sample medicines created`);

  mongoose.connection.close();
  console.log('✅ Seeding complete. Disconnected from MongoDB.');
};

seedData().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
