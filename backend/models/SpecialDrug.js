const mongoose = require('mongoose');

const specialDrugSchema = new mongoose.Schema({
  drugName: {
    type: String,
    required: [true, 'Drug name is required'],
    trim: true
  },
  buyerName: {
    type: String,
    required: [true, 'Buyer name is required'],
    trim: true
  },
  buyerIdNumber: {
    type: String,
    required: [true, 'Buyer ID number is required'],
    trim: true
  },
  buyerPhoneNumber: {
    type: String,
    required: [true, 'Buyer phone number is required'],
    trim: true
  },
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: false
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SpecialDrug', specialDrugSchema);
