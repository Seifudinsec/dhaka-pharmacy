const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");
const { protect } = require("../middleware/auth");

router.use(protect);

// GET /api/sales — sales history with optional date range
router.get("/", async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("servedBy", "username")
      .populate("items.medicine", "name");

    const revenue = await Sale.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    res.json({
      success: true,
      data: sales,
      totalRevenue: Number((revenue[0]?.total || 0).toFixed(2)),
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error("Get sales error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales." });
  }
});

// POST /api/sales — create a new sale (transactional)
router.post("/", async (req, res) => {
  const session = await mongoose.startSession();
  const warnings = [];
  let createdSale = null;

  try {
    const { items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Sale must contain at least one item.",
      });
    }

    await session.withTransaction(async () => {
      const saleItems = [];
      let totalAmount = 0;
      let totalProfit = 0;

      for (const rawItem of items) {
        const { medicineId, quantity } = rawItem || {};
        const qty = Number(quantity);

        if (!medicineId || Number.isNaN(qty) || qty < 1) {
          warnings.push(
            `Invalid item: medicineId=${medicineId}, quantity=${quantity}`,
          );
          continue;
        }

        const finalQty = Math.floor(qty);

        const medicine = await Medicine.findById(medicineId).session(session);
        if (!medicine) {
          warnings.push(`Medicine with ID "${medicineId}" not found.`);
          continue;
        }

        if (medicine.status === "inactive") {
          warnings.push(`"${medicine.name}" is inactive and cannot be sold.`);
          continue;
        }

        if (new Date() > new Date(medicine.expiryDate)) {
          warnings.push(`"${medicine.name}" is expired and cannot be sold.`);
          continue;
        }

        if (medicine.stock < finalQty) {
          warnings.push(
            `Insufficient stock for "${medicine.name}". Available: ${medicine.stock}, requested: ${finalQty}.`,
          );
          continue;
        }

        // Atomic stock deduction within transaction
        const stockUpdate = await Medicine.updateOne(
          { _id: medicine._id, stock: { $gte: finalQty } },
          { $inc: { stock: -finalQty } },
          { session },
        );

        if (!stockUpdate.modifiedCount) {
          warnings.push(
            `Failed to deduct stock for "${medicine.name}". Please retry.`,
          );
          continue;
        }

        const unitPrice = Number(medicine.price);
        const buyingPrice = Number(medicine.buyingPrice || medicine.price);
        const subtotal = Number((unitPrice * finalQty).toFixed(2));
        const itemProfit = Number(
          ((unitPrice - buyingPrice) * finalQty).toFixed(2),
        );

        saleItems.push({
          medicine: medicine._id,
          medicineName: medicine.name,
          quantity: finalQty,
          unitPrice,
          buyingPrice,
          subtotal,
          profit: itemProfit,
        });

        totalAmount += subtotal;
        totalProfit += itemProfit;
      }

      if (saleItems.length === 0) {
        const err = new Error("NO_VALID_ITEMS");
        err.code = "NO_VALID_ITEMS";
        throw err;
      }

      const [sale] = await Sale.create(
        [
          {
            items: saleItems,
            total: Number(totalAmount.toFixed(2)),
            totalProfit: Number(totalProfit.toFixed(2)),
            servedBy: req.user._id,
            notes: notes ? String(notes).trim().slice(0, 500) : undefined,
          },
        ],
        { session },
      );

      createdSale = sale;
    });

    return res.status(201).json({
      success: true,
      message: "Sale recorded successfully.",
      data: createdSale,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (error) {
    if (error.code === "NO_VALID_ITEMS") {
      return res.status(400).json({
        success: false,
        message: "Sale failed.",
        errors: warnings.length
          ? warnings
          : ["No valid sale items were provided."],
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid medicine ID in sale.",
      });
    }

    console.error("Create sale error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to process sale." });
  } finally {
    await session.endSession();
  }
});

// GET /api/sales/today — today's sales summary
router.get("/today", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sales = await Sale.find({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    const total = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalProfit = sales.reduce(
      (sum, s) =>
        sum +
        Number(
          s.totalProfit ??
            s.profit ??
            (Array.isArray(s.items)
              ? s.items.reduce(
                  (itemSum, item) => itemSum + (item.profit || 0),
                  0,
                )
              : 0),
        ),
      0,
    );

    res.json({
      success: true,
      count: sales.length,
      total: Number(total.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
    });
  } catch (error) {
    console.error("Get today sales error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch today sales." });
  }
});

module.exports = router;
