const mongoose = require("mongoose");

const importHistorySchema = new mongoose.Schema(
  {
    importId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    fileHash: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    totalRows: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    summary: {
      added: { type: Number, default: 0, min: 0 },
      updated: { type: Number, default: 0, min: 0 },
      duplicate: { type: Number, default: 0, min: 0 },
      invalid: { type: Number, default: 0, min: 0 },
      processed: { type: Number, default: 0, min: 0 },
      skipped: { type: Number, default: 0, min: 0 },
    },
    status: {
      type: String,
      enum: ["previewed", "processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    forced: {
      type: Boolean,
      default: false,
    },
    duplicateOfImportId: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    previewSnapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

importHistorySchema.index({ fileHash: 1, status: 1, createdAt: -1 });
importHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model("ImportHistory", importHistorySchema);
