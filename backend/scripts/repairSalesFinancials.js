#!/usr/bin/env node
"use strict";

/**
 * Repair script: recalculate and normalize sale net totals from returns.
 *
 * File: backend/scripts/repairSalesFinancials.js
 *
 * What it does:
 * 1) Loads each Sale
 * 2) Recomputes immutable gross totals from sale items
 * 3) Loads all Return records for that sale
 * 4) Derives expected net totals:
 *      netTotal       = max(0, grossTotal - returnedTotal)
 *      netTotalProfit = grossProfit - returnedProfit
 * 5) Recomputes sale status from cumulative returns:
 *      completed | partially_returned | fully_refunded
 * 6) Optionally writes fixes to DB
 *
 * Default mode is DRY RUN (no writes).
 *
 * Usage:
 *   node scripts/repairSalesFinancials.js
 *   node scripts/repairSalesFinancials.js --apply
 *   node scripts/repairSalesFinancials.js --apply --saleId=<saleObjectId>
 *   node scripts/repairSalesFinancials.js --apply --limit=100
 *
 * Env:
 *   MONGODB_URI (required)
 *   STRICT_TOLERANCE (optional, default 0.01)
 */

require("dotenv").config();
const mongoose = require("mongoose");

const Sale = require("../models/Sale");
const Return = require("../models/Return");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ONLY_SALE_ID = (args.find((a) => a.startsWith("--saleId=")) || "").split("=")[1] || null;
const LIMIT_RAW = (args.find((a) => a.startsWith("--limit=")) || "").split("=")[1];
const LIMIT = LIMIT_RAW ? Math.max(1, Number(LIMIT_RAW) || 1) : null;
const TOLERANCE = Number(process.env.STRICT_TOLERANCE || 0.01);

function round2(n) {
  return Number((Number(n) || 0).toFixed(2));
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function closeEnough(a, b, tol = TOLERANCE) {
  return Math.abs(round2(a) - round2(b)) <= tol;
}

function deriveGrossFromItems(items) {
  const list = Array.isArray(items) ? items : [];
  let grossTotal = 0;
  let grossProfit = 0;

  for (const item of list) {
    const qty = safeNum(item?.quantity, 0);
    const unitPrice = safeNum(item?.unitPrice, 0);
    const buyingPrice = safeNum(item?.buyingPrice, unitPrice);

    const subtotal = safeNum(item?.subtotal, round2(unitPrice * qty));
    const profit = safeNum(item?.profit, round2((unitPrice - buyingPrice) * qty));

    grossTotal += subtotal;
    grossProfit += profit;
  }

  return {
    grossTotal: round2(grossTotal),
    grossProfit: round2(grossProfit),
  };
}

function deriveSaleStatus(cumulativeReturnedValue, originalGrossTotal) {
  if (cumulativeReturnedValue <= 0) return "completed";
  if (cumulativeReturnedValue >= originalGrossTotal) return "fully_refunded";
  return "partially_returned";
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing.");
  await mongoose.connect(uri);
  console.log(`✅ Connected: ${mongoose.connection.name}`);
}

async function getSales() {
  const query = {};
  if (ONLY_SALE_ID) {
    if (!mongoose.isValidObjectId(ONLY_SALE_ID)) {
      throw new Error(`Invalid --saleId provided: ${ONLY_SALE_ID}`);
    }
    query._id = ONLY_SALE_ID;
  }

  let q = Sale.find(query).sort({ createdAt: -1 });
  if (LIMIT) q = q.limit(LIMIT);
  return q.lean();
}

async function getReturnsMapForSales(saleIds) {
  if (!saleIds.length) return new Map();

  const returns = await Return.find({ originalSale: { $in: saleIds } }).lean();
  const map = new Map();

  for (const r of returns) {
    const key = String(r.originalSale);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }

  return map;
}

function computeExpectedNet(grossTotal, grossProfit, returnsForSale) {
  let returnedTotal = 0;
  let returnedProfit = 0;

  for (const ret of returnsForSale) {
    returnedTotal += safeNum(ret?.totalRefund, 0);
    returnedProfit += safeNum(ret?.totalProfitLoss, 0);
  }

  returnedTotal = round2(returnedTotal);
  returnedProfit = round2(returnedProfit);

  const expectedNetTotal = round2(Math.max(0, grossTotal - returnedTotal));
  const expectedNetProfit = round2(grossProfit - returnedProfit);

  return {
    returnedTotal,
    returnedProfit,
    expectedNetTotal,
    expectedNetProfit,
  };
}

function needsRepair(sale, expected) {
  const storedTotal = round2(safeNum(sale.total, 0));
  const storedProfit = round2(safeNum(sale.totalProfit, safeNum(sale.profit, 0)));
  const storedStatus = sale.status || "completed";

  const totalMismatch = !closeEnough(storedTotal, expected.expectedNetTotal);
  const profitMismatch = !closeEnough(storedProfit, expected.expectedNetProfit);
  const statusMismatch = storedStatus !== expected.expectedStatus;

  return {
    totalMismatch,
    profitMismatch,
    statusMismatch,
    shouldRepair: totalMismatch || profitMismatch || statusMismatch,
    storedTotal,
    storedProfit,
    storedStatus,
  };
}

async function applyRepair(saleId, expected, session = null) {
  const update = {
    total: expected.expectedNetTotal,
    totalProfit: expected.expectedNetProfit,
    status: expected.expectedStatus,
  };

  // normalize returnTransactions to unique list of return ids
  if (Array.isArray(expected.returnIds) && expected.returnIds.length > 0) {
    update.returnTransactions = expected.returnIds;
  }

  const options = { runValidators: true };
  if (session) options.session = session;

  await Sale.updateOne({ _id: saleId }, { $set: update }, options);
}

async function run() {
  await connectDB();

  console.log(`Mode: ${APPLY ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);
  if (ONLY_SALE_ID) console.log(`Filter: saleId=${ONLY_SALE_ID}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log("");

  const sales = await getSales();
  if (!sales.length) {
    console.log("No sales found for the given filter.");
    return;
  }

  const saleIds = sales.map((s) => s._id);
  const returnsMap = await getReturnsMapForSales(saleIds);

  let repaired = 0;
  let checked = 0;
  let mismatches = 0;
  let negativeStoredTotals = 0;
  let negativeStoredProfits = 0;

  const preview = [];

  for (const sale of sales) {
    checked++;

    const gross = deriveGrossFromItems(sale.items);
    const saleReturns = returnsMap.get(String(sale._id)) || [];
    const expectedNet = computeExpectedNet(gross.grossTotal, gross.grossProfit, saleReturns);
    const expectedStatus = deriveSaleStatus(expectedNet.returnedTotal, gross.grossTotal);

    const expected = {
      ...expectedNet,
      expectedStatus,
      returnIds: saleReturns.map((r) => r._id),
      grossTotal: gross.grossTotal,
      grossProfit: gross.grossProfit,
      returnCount: saleReturns.length,
    };

    const check = needsRepair(sale, expected);

    if (check.storedTotal < 0) negativeStoredTotals++;
    if (check.storedProfit < 0) negativeStoredProfits++;

    if (check.shouldRepair) {
      mismatches++;

      preview.push({
        saleId: String(sale._id),
        createdAt: sale.createdAt,
        stored: {
          total: check.storedTotal,
          totalProfit: check.storedProfit,
          status: check.storedStatus,
        },
        expected: {
          total: expected.expectedNetTotal,
          totalProfit: expected.expectedNetProfit,
          status: expected.expectedStatus,
        },
        gross: {
          total: expected.grossTotal,
          totalProfit: expected.grossProfit,
        },
        returns: {
          count: expected.returnCount,
          totalRefund: expected.returnedTotal,
          totalProfitLoss: expected.returnedProfit,
        },
        mismatch: {
          total: check.totalMismatch,
          totalProfit: check.profitMismatch,
          status: check.statusMismatch,
        },
      });

      if (APPLY) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await applyRepair(sale._id, expected, session);
          });
          repaired++;
        } finally {
          await session.endSession();
        }
      }
    }
  }

  console.log("========== REPAIR SUMMARY ==========");
  console.log(`Sales checked:              ${checked}`);
  console.log(`Sales needing repair:       ${mismatches}`);
  console.log(`Repairs applied:            ${repaired}`);
  console.log(`Negative stored totals:     ${negativeStoredTotals}`);
  console.log(`Negative stored profits:    ${negativeStoredProfits}`);
  console.log("====================================");
  console.log("");

  if (!preview.length) {
    console.log("✅ No mismatches found.");
    return;
  }

  console.log(`⚠️ Mismatch preview (${Math.min(preview.length, 50)} of ${preview.length}):`);
  for (const row of preview.slice(0, 50)) {
    console.log(`\nSale ${row.saleId}`);
    console.log(`  Date: ${row.createdAt}`);
    console.log(
      `  Stored   -> total=${row.stored.total}, profit=${row.stored.totalProfit}, status=${row.stored.status}`
    );
    console.log(
      `  Expected -> total=${row.expected.total}, profit=${row.expected.totalProfit}, status=${row.expected.status}`
    );
    console.log(
      `  Gross/Returns -> grossTotal=${row.gross.total}, grossProfit=${row.gross.totalProfit}, returns=${row.returns.count}, refund=${row.returns.totalRefund}, profitLoss=${row.returns.totalProfitLoss}`
    );
    console.log(
      `  Mismatch flags -> total=${row.mismatch.total}, profit=${row.mismatch.totalProfit}, status=${row.mismatch.status}`
    );
  }

  if (!APPLY) {
    console.log("\nDRY RUN complete. Re-run with --apply to persist fixes.");
  } else {
    console.log("\n✅ APPLY run complete. Mismatched sales were normalized.");
  }
}

run()
  .catch((err) => {
    console.error("❌ Repair failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.connection.close();
    } catch (_) {
      // ignore
    }
  });
