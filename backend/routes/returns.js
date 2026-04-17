const express = require("express");
const mongoose = require("mongoose");
const { protect } = require("../middleware/auth");
const auditLog = require("../middleware/audit");
const Sale = require("../models/Sale");
const Return = require("../models/Return");
const Medicine = require("../models/Medicine");

const router = express.Router();

router.use(protect);

// POST /api/returns - Create a return/refund (transactional)
router.post("/", auditLog("SALE_RETURNED", "Return"), async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { originalSaleId, items, reason } = req.body;
    const userId = req.user._id;

    if (!originalSaleId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Original sale ID and at least one item are required",
      });
    }

    let returnRecord = null;
    let updatedSale = null;

    await session.withTransaction(async () => {
      const originalSale = await Sale.findById(originalSaleId)
        .populate("items.medicine", "name stock")
        .session(session);

      if (!originalSale) {
        const err = new Error("Original sale not found");
        err.status = 404;
        throw err;
      }

      // Use immutable baseline totals for status calculation
      const originalGrossTotal = originalSale.items.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      );

      const returnItems = [];

      for (const rawReturnItem of items) {
        const medicineId = String(rawReturnItem?.medicineId || "");
        const qty = Math.floor(Number(rawReturnItem?.quantity || 0));

        if (!medicineId || Number.isNaN(qty) || qty <= 0) {
          const err = new Error("Invalid return item payload");
          err.status = 400;
          throw err;
        }

        const originalItem = originalSale.items.find(
          (item) => String(item.medicine?._id || item.medicine) === medicineId,
        );

        if (!originalItem) {
          const err = new Error("Item not found in original sale");
          err.status = 400;
          throw err;
        }

        if (qty > originalItem.quantity) {
          const err = new Error(
            `Invalid return quantity for ${originalItem.medicineName}`,
          );
          err.status = 400;
          throw err;
        }

        // Sum previously returned qty for this sale+medicine
        const existingReturns = await Return.find({
          originalSale: originalSaleId,
          "items.medicine": medicineId,
        }).session(session);

        const totalReturnedQuantity = existingReturns.reduce((sum, ret) => {
          const returnedItem = ret.items.find(
            (item) => String(item.medicine) === medicineId,
          );
          return sum + (returnedItem ? Number(returnedItem.quantity || 0) : 0);
        }, 0);

        const remainingReturnable =
          originalItem.quantity - totalReturnedQuantity;
        if (qty > remainingReturnable) {
          const err = new Error(
            `Cannot return ${qty} units of ${originalItem.medicineName}. Only ${remainingReturnable} units available for return.`,
          );
          err.status = 400;
          throw err;
        }

        const unitPrice = Number(originalItem.unitPrice || 0);
        const buyingPrice = Number(originalItem.buyingPrice || 0);
        const subtotal = Number((qty * unitPrice).toFixed(2));
        const profit = Number((qty * (unitPrice - buyingPrice)).toFixed(2));

        returnItems.push({
          medicine: medicineId,
          medicineName: originalItem.medicineName,
          quantity: qty,
          unitPrice,
          buyingPrice,
          subtotal,
          profit,
        });

        // Return stock to inventory
        await Medicine.updateOne(
          { _id: medicineId },
          { $inc: { stock: qty } },
          { session },
        );
      }

      const totalRefund = Number(
        returnItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2),
      );
      const totalProfitLoss = Number(
        returnItems.reduce((sum, item) => sum + item.profit, 0).toFixed(2),
      );

      const [createdReturn] = await Return.create(
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
      returnRecord = createdReturn;

      // Recompute cumulative returned value using immutable return records
      const allReturns = await Return.find({
        originalSale: originalSaleId,
      }).session(session);
      const cumulativeReturnedValue = allReturns.reduce(
        (sum, ret) => sum + Number(ret.totalRefund || 0),
        0,
      );

      let newStatus = "completed";
      if (
        cumulativeReturnedValue > 0 &&
        cumulativeReturnedValue < originalGrossTotal
      ) {
        newStatus = "partially_returned";
      } else if (cumulativeReturnedValue >= originalGrossTotal) {
        newStatus = "fully_refunded";
      }

      updatedSale = await Sale.findByIdAndUpdate(
        originalSaleId,
        {
          status: newStatus,
          $push: { returnTransactions: returnRecord._id },
          $inc: {
            total: -totalRefund,
            totalProfit: -totalProfitLoss,
          },
        },
        { new: true, session },
      );
    });

    return res.status(201).json({
      success: true,
      message: "Return processed successfully",
      data: returnRecord,
      sale: {
        id: updatedSale?._id,
        status: updatedSale?.status,
        total: updatedSale?.total,
        totalProfit: updatedSale?.totalProfit,
      },
    });
  } catch (error) {
    console.error("Return processing error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to process return",
    });
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
