#!/usr/bin/env node
"use strict";

/**
 * Audit script: detect inconsistent and negative sales financial totals.
 *
 * Usage:
 *   node scripts/auditSalesFinancials.js
 *
 * Optional env:
 *   STRICT_TOLERANCE=0.01   # default 0.01
 *
 * This script:
 * 1) Loads all sales.
 * 2) Recomputes gross totals from sale items.
 * 3) Loads linked returns per sale and computes cumulative returned totals.
 * 4) Derives expected net totals:
 *      expectedNetTotal = max(0, grossTotal - returnedTotal)
 *      expectedNetProfit = grossProfit - returnedProfit
 * 5) Flags problems:
 *    - negative stored totals
 *    - mismatch between stored and expected net totals
 *    - mismatched item-level subtotal/profit
 *    - suspicious data shape gaps
 */

require("dotenv").config();
const mongoose = require("mongoose");

const Sale = require("../models/Sale");
const Return = require("../models/Return");

const TOLERANCE = Number(process.env.STRICT_TOLERANCE || 0.01);

function round2(n) {
  return Number((Number(n) || 0).toFixed(2));
}

function abs(n) {
  return Math.abs(Number(n) || 0);
}

function closeEnough(a, b, tol = TOLERANCE) {
  return abs(round2(a) - round2(b)) <= tol;
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }
  await mongoose.connect(uri);
  console.log(`✅ Connected to MongoDB: ${mongoose.connection.name}`);
}

function computeGrossFromSaleItems(sale) {
  const items = Array.isArray(sale.items) ? sale.items : [];

  let grossTotal = 0;
  let grossProfit = 0;
  let itemLevelIssues = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const qty = safeNum(it.quantity, 0);
    const unitPrice = safeNum(it.unitPrice, 0);
    const buyingPrice = safeNum(it.buyingPrice, unitPrice);

    const computedSubtotal = round2(unitPrice * qty);
    const computedProfit = round2((unitPrice - buyingPrice) * qty);

    const storedSubtotal = safeNum(it.subtotal, computedSubtotal);
    const storedProfit = safeNum(it.profit, computedProfit);

    grossTotal += storedSubtotal;
    grossProfit += storedProfit;

    if (!closeEnough(storedSubtotal, computedSubtotal)) {
      itemLevelIssues.push({
        index: i,
        medicineName: it.medicineName || "Unknown",
        type: "ITEM_SUBTOTAL_MISMATCH",
        storedSubtotal: round2(storedSubtotal),
        computedSubtotal: round2(computedSubtotal),
      });
    }

    if (!closeEnough(storedProfit, computedProfit)) {
      itemLevelIssues.push({
        index: i,
        medicineName: it.medicineName || "Unknown",
        type: "ITEM_PROFIT_MISMATCH",
        storedProfit: round2(storedProfit),
        computedProfit: round2(computedProfit),
      });
    }
  }

  return {
    grossTotal: round2(grossTotal),
    grossProfit: round2(grossProfit),
    itemLevelIssues,
  };
}

async function computeReturnsForSale(saleId) {
  const returns = await Return.find({ originalSale: saleId }).lean();

  let returnedTotal = 0;
  let returnedProfit = 0;

  for (const ret of returns) {
    returnedTotal += safeNum(ret.totalRefund, 0);
    returnedProfit += safeNum(ret.totalProfitLoss, 0);
  }

  return {
    returnCount: returns.length,
    returnedTotal: round2(returnedTotal),
    returnedProfit: round2(returnedProfit),
  };
}

function classifySaleHealth(sale, calc) {
  const issues = [];
  const storedTotal = round2(safeNum(sale.total, 0));
  const storedProfit = round2(
    safeNum(
      sale.totalProfit,
      // legacy fallback
      safeNum(sale.profit, 0)
    )
  );

  const expectedNetTotal = round2(
    Math.max(0, calc.grossTotal - calc.returnedTotal)
  );
  const expectedNetProfit = round2(calc.grossProfit - calc.returnedProfit);

  if (storedTotal < 0) {
    issues.push({
      type: "NEGATIVE_STORED_TOTAL",
      storedTotal,
    });
  }

  if (storedProfit < 0) {
    // negative profit can be valid in business terms, so mark as warning
    issues.push({
      type: "NEGATIVE_STORED_PROFIT_WARNING",
      storedProfit,
    });
  }

  if (!closeEnough(storedTotal, expectedNetTotal)) {
    issues.push({
      type: "NET_TOTAL_MISMATCH",
      storedTotal,
      expectedNetTotal,
      delta: round2(storedTotal - expectedNetTotal),
    });
  }

  if (!closeEnough(storedProfit, expectedNetProfit)) {
    issues.push({
      type: "NET_PROFIT_MISMATCH",
      storedProfit,
      expectedNetProfit,
      delta: round2(storedProfit - expectedNetProfit),
    });
  }

  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    issues.push({
      type: "MISSING_SALE_ITEMS",
      note: "Sale has no line items.",
    });
  }

  return {
    storedTotal,
    storedProfit,
    expectedNetTotal,
    expectedNetProfit,
    issues,
  };
}

async function runAudit() {
  await connectDB();

  const sales = await Sale.find({})
    .sort({ createdAt: -1 })
    .lean();

  console.log(`ℹ️ Loaded ${sales.length} sales for audit.\n`);

  let totals = {
    sales: 0,
    withIssues: 0,
    negativeTotals: 0,
    netTotalMismatch: 0,
    netProfitMismatch: 0,
    itemLevelIssues: 0,
  };

  const findings = [];

  for (const sale of sales) {
    totals.sales++;

    const gross = computeGrossFromSaleItems(sale);
    const ret = await computeReturnsForSale(sale._id);

    const health = classifySaleHealth(sale, {
      grossTotal: gross.grossTotal,
      grossProfit: gross.grossProfit,
      returnedTotal: ret.returnedTotal,
      returnedProfit: ret.returnedProfit,
    });

    const combinedIssues = [...health.issues, ...gross.itemLevelIssues];

    if (combinedIssues.length > 0) {
      totals.withIssues++;
      totals.itemLevelIssues += gross.itemLevelIssues.length;

      if (health.issues.some((x) => x.type === "NEGATIVE_STORED_TOTAL")) {
        totals.negativeTotals++;
      }
      if (health.issues.some((x) => x.type === "NET_TOTAL_MISMATCH")) {
        totals.netTotalMismatch++;
      }
      if (health.issues.some((x) => x.type === "NET_PROFIT_MISMATCH")) {
        totals.netProfitMismatch++;
      }

      findings.push({
        saleId: String(sale._id),
        createdAt: sale.createdAt,
        servedBy: sale.servedBy || null,
        status: sale.status || "completed",
        returnCount: ret.returnCount,
        grossTotal: gross.grossTotal,
        grossProfit: gross.grossProfit,
        returnedTotal: ret.returnedTotal,
        returnedProfit: ret.returnedProfit,
        storedTotal: health.storedTotal,
        storedProfit: health.storedProfit,
        expectedNetTotal: health.expectedNetTotal,
        expectedNetProfit: health.expectedNetProfit,
        issues: combinedIssues,
      });
    }
  }

  console.log("========== AUDIT SUMMARY ==========");
  console.log(`Total sales checked:           ${totals.sales}`);
  console.log(`Sales with issues:             ${totals.withIssues}`);
  console.log(`Negative stored totals:        ${totals.negativeTotals}`);
  console.log(`Net total mismatches:          ${totals.netTotalMismatch}`);
  console.log(`Net profit mismatches:         ${totals.netProfitMismatch}`);
  console.log(`Item-level issues:             ${totals.itemLevelIssues}`);
  console.log("===================================\n");

  if (findings.length === 0) {
    console.log("✅ No inconsistencies detected.");
    return;
  }

  console.log("⚠️ Detailed findings (first 50):\n");
  for (const f of findings.slice(0, 50)) {
    console.log(`Sale: ${f.saleId}`);
    console.log(`  Date: ${f.createdAt}`);
    console.log(`  Status: ${f.status} | Returns: ${f.returnCount}`);
    console.log(
      `  Stored Totals: total=${f.storedTotal}, profit=${f.storedProfit}`
    );
    console.log(
      `  Expected Net : total=${f.expectedNetTotal}, profit=${f.expectedNetProfit}`
    );
    console.log(
      `  Gross/Returned: grossTotal=${f.grossTotal}, grossProfit=${f.grossProfit}, returnedTotal=${f.returnedTotal}, returnedProfit=${f.returnedProfit}`
    );
    console.log("  Issues:");
    for (const issue of f.issues) {
      console.log(`   - ${issue.type}: ${JSON.stringify(issue)}`);
    }
    console.log("");
  }

  if (findings.length > 50) {
    console.log(
      `...and ${findings.length - 50} more records with issues not printed.`
    );
  }
}

runAudit()
  .catch((err) => {
    console.error("❌ Audit failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.connection.close();
    } catch (_) {
      // ignore close errors
    }
  });
