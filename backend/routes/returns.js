const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const auditLog = require("../middleware/audit");
const Sale = require("../models/Sale");
const Return = require("../models/Return");
const Medicine = require("../models/Medicine");
const { getIO } = require("../config/socket");

const router = express.Router();

router.use(protect);

// POST /api/returns - Create a return/refund (transactional)
router.post("/", auditLog("SALE_RETURNED", "Return"), async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { originalSaleId, items, reason } = req.body;
    const userId = req.user._id;

    if (!originalSaleId || !items?.length) {
      return res.status(400).json({
        success: false,
        message: "Original sale ID and items are required",
      });
    }

    let returnRecord = null;
    let updatedSale = null;

    await session.withTransaction(async () => {
      const originalSale = await Sale.findById(originalSaleId)
        .populate("items.medicine", "name stock")
        .session(session);

      if (!originalSale) {
        throw { status: 404, message: "Original sale not found" };
      }

      const originalGrossTotal = originalSale.items.reduce(
        (sum, i) => sum + (i.subtotal || 0),
        0,
      );
      const originalGrossProfit = originalSale.items.reduce(
        (sum, i) => sum + (i.profit || 0),
        0,
      );

      const returnItems = [];
      for (const item of items) {
        const medicineId = String(item?.medicineId || "");
        const qty = Math.floor(Number(item?.quantity || 0));

        if (!medicineId || isNaN(qty) || qty <= 0) {
          throw { status: 400, message: "Invalid return item payload" };
        }

        const orig = originalSale.items.find(
          (i) => String(i.medicine?._id || i.medicine) === medicineId,
        );
        if (!orig)
          throw {
            status: 400,
            message: `Item ${medicineId} not in original sale`,
          };
        if (qty > orig.quantity)
          throw {
            status: 400,
            message: `Invalid return quantity for ${orig.medicineName}`,
          };

        const prevReturns = await Return.find({
          originalSale: originalSaleId,
          "items.medicine": medicineId,
        }).session(session);
        const totalReturned = prevReturns.reduce((sum, r) => {
          const ri = r.items.find((i) => String(i.medicine) === medicineId);
          return sum + (ri ? Number(ri.quantity) : 0);
        }, 0);

        if (qty > orig.quantity - totalReturned) {
          throw {
            status: 400,
            message: `Cannot return ${qty} units of ${orig.medicineName}.`,
          };
        }

        const subtotal = Number((qty * orig.unitPrice).toFixed(2));
        const profit = Number(
          (qty * (orig.unitPrice - orig.buyingPrice)).toFixed(2),
        );

        returnItems.push({
          medicine: medicineId,
          medicineName: orig.medicineName,
          quantity: qty,
          unitPrice: orig.unitPrice,
          buyingPrice: orig.buyingPrice,
          subtotal,
          profit,
        });

        await Medicine.updateOne(
          { _id: medicineId },
          { $inc: { stock: qty } },
          { session },
        );
      }

      const totalRefund = Number(
        returnItems.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2),
      );
      const totalProfitLoss = Number(
        returnItems.reduce((sum, i) => sum + i.profit, 0).toFixed(2),
      );

      [returnRecord] = await Return.create(
        [
          {
            originalSale: originalSaleId,
            items: returnItems,
            totalRefund,
            totalProfitLoss,
            reason: reason || "Customer return",
            processedBy: userId,
            status: "approved",
          },
        ],
        { session },
      );

      const allReturns = await Return.find({
        originalSale: originalSaleId,
      }).session(session);
      const cumulativeRefund = allReturns.reduce(
        (sum, r) => sum + (r.totalRefund || 0),
        0,
      );
      const cumulativeProfitLoss = allReturns.reduce(
        (sum, r) => sum + (r.totalProfitLoss || 0),
        0,
      );

      const nextTotal = Math.max(0, originalGrossTotal - cumulativeRefund);
      const nextProfit = originalGrossProfit - cumulativeProfitLoss;
      const nextStatus =
        cumulativeRefund >= originalGrossTotal
          ? "fully_refunded"
          : cumulativeRefund > 0
            ? "partially_returned"
            : "completed";

      updatedSale = await Sale.findByIdAndUpdate(
        originalSaleId,
        {
          status: nextStatus,
          total: Number(nextTotal.toFixed(2)),
          totalProfit: Number(nextProfit.toFixed(2)),
          $addToSet: { returnTransactions: returnRecord._id },
        },
        { new: true, session },
      );
    });

    try {
      getIO().emit("inventory_updated", { type: "return" });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: "Return processed successfully",
      data: returnRecord,
      sale: {
        id: updatedSale?._id,
        status: updatedSale?.status,
        total: updatedSale?.total,
      },
    });
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ success: false, message: error.message || "Return failed" });
  } finally {
    await session.endSession();
  }
});

// GET /api/returns - Get all returns (admin sees all, pharmacist sees own)
router.get("/", async (req, res) => {
  try {
    const query =
      req.user.role === "pharmacist" ? { processedBy: req.user._id } : {};

    const returns = await Return.find(query)
      .populate("originalSale", "total createdAt status")
      .populate("processedBy", "username")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: returns,
    });
  } catch (error) {
    console.error("Get returns error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch returns",
    });
  }
});

// GET /api/returns/:id - Get specific return details
router.get("/:id", async (req, res) => {
  try {
    const returnRecord = await Return.findById(req.params.id)
      .populate("originalSale")
      .populate("processedBy", "username");

    if (!returnRecord) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    if (
      req.user.role === "pharmacist" &&
      String(returnRecord.processedBy?._id) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    return res.json({
      success: true,
      data: returnRecord,
    });
  } catch (error) {
    console.error("Get return error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch return",
    });
  }
});

// PUT /api/returns/:id/status - Update return status (admin only)
router.put("/:id/status", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    const { status } = req.body;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const returnRecord = await Return.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    ).populate("processedBy", "username");

    if (!returnRecord) {
      return res.status(404).json({
        success: false,
        message: "Return not found",
      });
    }

    return res.json({
      success: true,
      message: `Return ${status} successfully`,
      data: returnRecord,
    });
  } catch (error) {
    console.error("Update return status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update return status",
    });
  }
});

module.exports = router;
