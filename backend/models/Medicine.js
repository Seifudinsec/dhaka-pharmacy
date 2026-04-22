const mongoose = require("mongoose");

const normalizeText = (value = "") =>
  String(value).trim().toLowerCase().replace(/\s+/g, " ");

const normalizeBatch = (value = "") =>
  String(value).trim().toUpperCase().replace(/\s+/g, "");

const toDateKey = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Medicine name is required"],
      trim: true,
      maxlength: [200, "Medicine name must not exceed 200 characters"],
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    productKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0.01, "Price must be greater than 0"],
    },
    buyingPrice: {
      type: Number,
      required: [true, "Buying price is required"],
      min: [0.01, "Buying price must be greater than 0"],
    },
    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      trim: true,
      maxlength: [100, "Batch number must not exceed 100 characters"],
    },
    batchNumberNormalized: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    expiryDateKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    lastImportId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: isExpired
medicineSchema.virtual("isExpired").get(function () {
  return new Date() > new Date(this.expiryDate);
});

// Virtual: isLowStock
medicineSchema.virtual("isLowStock").get(function () {
  return this.stock > 0 && this.stock < 10;
});

// Virtual: stockStatus
medicineSchema.virtual("stockStatus").get(function () {
  if (this.stock === 0) return "out_of_stock";
  if (this.stock < 10) return "low";
  return "ok";
});

medicineSchema.virtual("unitProfit").get(function () {
  return Number((this.price - this.buyingPrice).toFixed(2));
});

medicineSchema.virtual("estimatedStockProfit").get(function () {
  return Number(((this.price - this.buyingPrice) * this.stock).toFixed(2));
});

medicineSchema.pre("validate", function populateDerivedFields(next) {
  this.normalizedName = normalizeText(this.name);
  this.productKey = this.normalizedName;
  this.batchNumberNormalized = normalizeBatch(this.batchNumber || "");
  this.expiryDateKey = toDateKey(this.expiryDate);
  next();
});

medicineSchema.index({
  productKey: 1,
  batchNumberNormalized: 1,
  expiryDateKey: 1,
}, {
  unique: true,
  name: "uniq_product_batch_expiry",
});

medicineSchema.index({ name: "text" });

module.exports = mongoose.model("Medicine", medicineSchema);
