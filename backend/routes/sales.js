const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Sale = require("../models/Sale");
const Medicine = require("../models/Medicine");
const SpecialDrug = require("../models/SpecialDrug");
const { protect } = require("../middleware/auth");

const { getIO } = require("../config/socket");

router.use(protect);

const normalizeName = (value = "") =>
  String(value).trim().toLowerCase().replace(/\s+/g, " ");

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    const { items, notes, specialDrugDetails } = req.body;

    if (!items?.length) {
      return res.status(400).json({
        success: false,
        message: "Sale must contain at least one item.",
      });
    }

    if (specialDrugDetails) {
      const { buyerName, buyerIdNumber, buyerPhoneNumber } = specialDrugDetails;
      if (!buyerName || !buyerIdNumber || !buyerPhoneNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Special drug details are incomplete. All fields are required if filled.",
        });
      }
    }

    const stockAlerts = [];

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

        const selectedMedicine = await Medicine.findById(medicineId).session(
          session,
        );
        if (!selectedMedicine) {
          warnings.push(`Medicine not found: ${medicineId}`);
          continue;
        }

        if (selectedMedicine.status === "inactive") {
          warnings.push(`"${selectedMedicine.name}" is inactive.`);
          continue;
        }

        const now = new Date();
        const productKey =
          selectedMedicine.productKey || normalizeName(selectedMedicine.name);
        const candidateBatches = await Medicine.find({
          status: "active",
          stock: { $gt: 0 },
          expiryDate: { $gt: now },
          $or: [
            { productKey },
            { normalizedName: productKey },
            {
              name: {
                $regex: `^${escapeRegex(selectedMedicine.name)}$`,
                $options: "i",
              },
            },
          ],
        })
          .sort({ expiryDate: 1, createdAt: 1 })
          .session(session);

        const totalAvailable = candidateBatches.reduce(
          (sum, batch) => sum + Number(batch.stock || 0),
          0,
        );
        if (totalAvailable < finalQty) {
          warnings.push(`Insufficient stock for "${selectedMedicine.name}".`);
          continue;
        }

        let remaining = finalQty;
        for (const batch of candidateBatches) {
          if (remaining <= 0) break;
          const allocQty = Math.min(remaining, Number(batch.stock || 0));
          if (allocQty <= 0) continue;

          const stockUpdate = await Medicine.updateOne(
            { _id: batch._id, stock: { $gte: allocQty } },
            { $inc: { stock: -allocQty } },
            { session },
          );
          if (!stockUpdate.modifiedCount) {
            warnings.push(`Failed to update stock for "${batch.name}".`);
            continue;
          }

          const newStock = Number(batch.stock || 0) - allocQty;
          if (newStock === 0) {
            stockAlerts.push({
              id: batch._id.toString(),
              name: batch.name,
              stock: 0,
              alertType: "out_of_stock",
            });
          } else if (newStock < 10) {
            stockAlerts.push({
              id: batch._id.toString(),
              name: batch.name,
              stock: newStock,
              alertType: "low_stock",
            });
          }

          const unitPrice = Number(batch.price);
          const buyingPrice = Number(batch.buyingPrice || batch.price);
          const subtotal = Number((unitPrice * allocQty).toFixed(2));
          const itemProfit = Number(
            ((unitPrice - buyingPrice) * allocQty).toFixed(2),
          );

          saleItems.push({
            medicine: batch._id,
            medicineName: batch.name,
            quantity: allocQty,
            unitPrice,
            buyingPrice,
            subtotal,
            profit: itemProfit,
          });

          totalAmount += subtotal;
          totalProfit += itemProfit;
          remaining -= allocQty;
        }

        if (remaining > 0) {
          throw {
            code: "ALLOCATION_FAILED",
            message: `Could not allocate stock safely for "${selectedMedicine.name}". Please retry.`,
          };
        }
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

      if (specialDrugDetails) {
        // Automatically compile drug names from the sale items
        const drugNames = saleItems.map((item) => item.medicineName).join(", ");

        const [record] = await SpecialDrug.create(
          [
            {
              ...specialDrugDetails,
              drugName: drugNames,
              amount: sale.total,
              sale: sale._id,
              recordedBy: req.user._id,
            },
          ],
          { session },
        );
        sale.specialDrugRecord = record._id;
        await sale.save({ session });
      }

      createdSale = sale;
    });

    try {
      getIO().emit("inventory_updated", { type: "sale", stockAlerts });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: "Sale recorded successfully.",
      data: createdSale,
      stockAlerts: stockAlerts.length ? stockAlerts : undefined,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (error) {
    if (error.code === "ALLOCATION_FAILED") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
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
