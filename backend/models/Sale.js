const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    },
    medicineName: { type: String, required: true },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Unit price cannot be negative"],
    },
    buyingPrice: {
      type: Number,
      required: true,
      min: [0, "Buying price cannot be negative"],
    },
    subtotal: {
      type: Number,
      required: true,
    },
    profit: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const saleSchema = new mongoose.Schema(
  {
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: "A sale must have at least one item",
      },
    },
    total: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },
    totalProfit: {
      type: Number,
      required: true,
      default: 0,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    specialDrugRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SpecialDrug",
    },
    status: {
      type: String,
      enum: ["completed", "partially_returned", "fully_refunded"],
      default: "completed",
    },
    returnTransactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Return",
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Sale", saleSchema);
