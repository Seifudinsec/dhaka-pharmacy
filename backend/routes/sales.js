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

    const [total, sales, revenue] = await Promise.all([
      Sale.countDocuments(query),
      Sale.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("servedBy", "username")
        .populate("items.medicine", "name"),
      Sale.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
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

    if (!items?.length) {
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
        const finalQty = Math.floor(Number(quantity));

        if (!medicineId || isNaN(finalQty) || finalQty < 1) {
          warnings.push(`Invalid item: ID=${medicineId}, Qty=${quantity}`);
          continue;
        }

        const medicine = await Medicine.findById(medicineId).session(session);
        if (!medicine) {
          warnings.push(`Medicine not found: ${medicineId}`);
          continue;
        }

        if (medicine.status === "inactive") {
          warnings.push(`"${medicine.name}" is inactive.`);
          continue;
        }

        if (new Date() > new Date(medicine.expiryDate)) {
          warnings.push(`"${medicine.name}" is expired.`);
          continue;
        }

        if (medicine.stock < finalQty) {
          warnings.push(`Insufficient stock for "${medicine.name}".`);
          continue;
        }

        const stockUpdate = await Medicine.updateOne(
          { _id: medicine._id, stock: { $gte: finalQty } },
          { $inc: { stock: -finalQty } },
          { session },
        );

        if (!stockUpdate.modifiedCount) {
          warnings.push(`Failed to update stock for "${medicine.name}".`);
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

      if (!saleItems.length) {
        throw { code: "NO_VALID_ITEMS" };
      }

      const [sale] = await Sale.create(
        [
          {
            items: saleItems,
            total: Number(totalAmount.toFixed(2)),
            totalProfit: Number(totalProfit.toFixed(2)),
            servedBy: req.user._id,
            notes: notes?.trim().slice(0, 500),
          },
        ],
        { session },
      );

      createdSale = sale;
    });

    res.status(201).json({
      success: true,
      message: "Sale recorded successfully.",
      data: createdSale,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (error) {
    if (error.code === "NO_VALID_ITEMS") {
      return res.status(400).json({
        success: false,
        message: "Sale failed: No valid items.",
        errors: warnings,
      });
    }
    res
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

    const stats = await Sale.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: "$total" },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]);

    const result = stats[0] || { count: 0, total: 0, totalProfit: 0 };

    res.json({
      success: true,
      count: result.count,
      total: Number(result.total.toFixed(2)),
      totalProfit: Number(result.totalProfit.toFixed(2)),
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch today's sales." });
  }
});

module.exports = router;
