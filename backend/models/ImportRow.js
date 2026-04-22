const mongoose = require("mongoose");

const importRowSchema = new mongoose.Schema(
  {
    importId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    rowNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    rowKey: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    expiryDateKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    buyingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["processed", "duplicate", "invalid"],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: "",
      maxlength: 500,
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

importRowSchema.index({ rowKey: 1, status: 1, createdAt: -1 });
importRowSchema.index({ importId: 1, rowNumber: 1 }, { unique: true });

module.exports = mongoose.model("ImportRow", importRowSchema);
