import { createServer } from "http";
import { URL } from "url";

const PORT = parseInt(process.env.API_PORT || "8901", 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

let lastHeaders = {
  authorization: null,
  cookie: null,
};

let simulateReadyzUnavailable = false;
let bnplVariant = "insufficient_data"; // or "ok"
let reminderEmail = "";

const readJsonBody = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });

const readRawBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

const importedFiles = new Set();
const importFileById = new Map();
let nextImportId = 1;

const alinmaRows = [
  {
    posted_date: "2026-01-05",
    description_raw: "SAR 25.75 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE CO",
    debit: 2575,
    credit: 0,
    balance_after: 97425,
    kind: "card_purchase",
    merchant_raw: "SAMPLE CO",
    card_last4: "0630",
    fingerprint: "alinma-1",
    default_selected: true,
  },
  {
    posted_date: "2026-01-06",
    description_raw: "معاملة شراء عبر الإنترنت SAR من SAMPLE ONLINE",
    debit: 1000,
    credit: 0,
    balance_after: 96425,
    kind: "online_purchase",
    merchant_raw: "SAMPLE ONLINE",
    fingerprint: "alinma-2",
    default_selected: true,
  },
  {
    posted_date: "2026-01-07",
    description_raw: "معاملة إعادة الشراء SAR من SAMPLE ONLINE",
    debit: 0,
    credit: 1000,
    balance_after: 97425,
    kind: "refund",
    merchant_raw: "SAMPLE ONLINE",
    fingerprint: "alinma-3",
    default_selected: true,
  },
];

function buildPreview(filename) {
  const importId = nextImportId++;
  importFileById.set(importId, filename);

  const base = {
    import_id: importId,
    status: "pending",
    already_imported: importedFiles.has(filename),
    resumed: false,
    account_number: "****0001",
    parser_version: "1",
    period_start: "2026-01-01",
    period_end: "2026-01-31",
  };

  if (filename.includes("rejected")) {
    return {
      ...base,
      status: "rejected",
      bank: "Alinma",
      parser: "alinma",
      header: {
        opening_balance: 100000,
        closing_balance: 118600,
        stated_debit_total: 62500,
        stated_credit_total: 81000,
        stated_debit_count: 1,
        stated_credit_count: 1,
      },
      reconciliation: {
        ok: false,
        checks: [
          { name: "debit_total", status: "fail", parsed: "625.00", stated: "625.00" },
          { name: "balance_walk", status: "fail", parsed: "984.25", stated: "1,186.00" },
        ],
        parsed_debit_total: 62500,
        parsed_credit_total: 81000,
        parsed_debit_count: 1,
        parsed_credit_count: 1,
      },
      rows: alinmaRows,
      summary: {
        rows: alinmaRows.length,
        exact_duplicates: 0,
        needs_review: 0,
        default_rows: alinmaRows.length,
        history_rows: 0,
        anomaly_ready: true,
      },
    };
  }

  if (filename.includes("alinma")) {
    return {
      ...base,
      bank: "Alinma",
      parser: "alinma",
      header: {
        opening_balance: 100000,
        closing_balance: 118600,
        stated_debit_total: 62400,
        stated_credit_total: 81000,
        stated_debit_count: 12,
        stated_credit_count: 3,
      },
      reconciliation: {
        ok: true,
        checks: [
          { name: "debit_total", status: "pass", parsed: "624.00", stated: "624.00" },
          { name: "credit_total", status: "pass", parsed: "810.00", stated: "810.00" },
          { name: "balance_walk", status: "pass", parsed: "1,186.00", stated: "1,186.00" },
        ],
        parsed_debit_total: 62400,
        parsed_credit_total: 81000,
        parsed_debit_count: 12,
        parsed_credit_count: 3,
      },
      rows: alinmaRows,
      summary: {
        rows: alinmaRows.length,
        exact_duplicates: 0,
        needs_review: 0,
        default_rows: alinmaRows.length,
        history_rows: 0,
        anomaly_ready: true,
      },
    };
  }

  const rows = [
    {
      posted_date: "2026-01-05",
      description_raw: "POS purchase Apple pay (Domestic) SAMPLE STORE",
      debit: 2575,
      credit: 0,
      balance_after: 97425,
      kind: "card_purchase",
      merchant_raw: "SAMPLE STORE",
      card_last4: "0000",
      fingerprint: "alrajhi-1",
      default_selected: true,
    },
    {
      posted_date: "2026-01-06",
      description_raw: "Online purchase Apple pay (Domestic) SAMPLE ONLINE",
      debit: 1000,
      credit: 0,
      balance_after: 96425,
      kind: "online_purchase",
      merchant_raw: "SAMPLE ONLINE",
      fingerprint: "alrajhi-2",
      default_selected: true,
    },
  ];

  if (filename.includes("duplicate.pdf")) {
    rows.push({
      posted_date: "2026-01-05",
      description_raw: "POS purchase Apple pay (Domestic) SAMPLE STORE",
      debit: 2575,
      credit: 0,
      balance_after: 93850,
      kind: "card_purchase",
      merchant_raw: "SAMPLE STORE",
      card_last4: "0000",
      fingerprint: "alrajhi-1",
      duplicate: { exact: true, score: 100, reason: "Exact fingerprint match" },
      default_selected: false,
    });
    rows.push({
      posted_date: "2026-01-12",
      description_raw: "POS purchase Apple pay (Domestic) UNUSUAL MERCHANT",
      debit: 90000,
      credit: 0,
      balance_after: 3850,
      kind: "card_purchase",
      merchant_raw: "UNUSUAL MERCHANT",
      card_last4: "0000",
      fingerprint: "alrajhi-3",
      anomaly: { score: 8.5, reason: "Unusual amount for this merchant" },
      default_selected: false,
    });
  }

  return {
    ...base,
    bank: "Al Rajhi",
    parser: "alrajhi",
    header: {
      opening_balance: 100000,
      closing_balance: 44567,
      stated_debit_total: 60000,
      stated_credit_total: 4567,
      stated_debit_count: 3,
      stated_credit_count: 1,
    },
    reconciliation: {
      ok: true,
      checks: [
        { name: "debit_total", status: "pass", parsed: "600.00", stated: "600.00" },
        { name: "credit_total", status: "pass", parsed: "45.67", stated: "45.67" },
        { name: "balance_walk", status: "pass", parsed: "445.67", stated: "445.67" },
      ],
      parsed_debit_total: 60000,
      parsed_credit_total: 4567,
      parsed_debit_count: 3,
      parsed_credit_count: 1,
    },
    rows,
    summary: {
      rows: rows.length,
      exact_duplicates: rows.filter((row) => row.duplicate?.exact).length,
      needs_review: 0,
      default_rows: rows.filter((row) => row.default_selected).length,
      history_rows: 0,
      anomaly_ready: true,
    },
  };
}

const generateTransactions = (offset = 0, limit = 100, bucket = "all", merchantId = null) => {
  const merchants = [
    { id: 1, name: "Rent Agency" },
    { id: 2, name: "Supermarket X" },
    { id: 3, name: "Coffee House" },
    { id: 4, name: "Electricity Company" },
    { id: 5, name: "Salary Employer" },
    { id: 9, name: "Sample Market" },
  ];

  const transactions = [
    { id: 34, account_id: 1, posted_date: "2026-03-05", posted_time: "10:15:00", description: "card purchase sample market", debit: 2575, credit: 0, balance_after: 118600, kind: "card_purchase", counts_as_spending: true, merchant_id: 9, merchant_name: "Sample Market", category_id: 3, category_name: "Groceries", fx_currency: null, fx_amount: null },
    { id: 33, account_id: 1, posted_date: "2026-03-04", posted_time: "14:30:00", description: "online purchase", debit: 1500, credit: 0, balance_after: 121175, kind: "online_purchase", counts_as_spending: true, merchant_id: 2, merchant_name: "Supermarket X", category_id: 3, category_name: "Groceries", fx_currency: null, fx_amount: null },
    { id: 32, account_id: 1, posted_date: "2026-03-03", posted_time: "09:00:00", description: "rent payment", debit: 350000, credit: 0, balance_after: 122675, kind: "bill_payment", counts_as_spending: true, merchant_id: 1, merchant_name: "Rent Agency", category_id: 1, category_name: "Housing", fx_currency: null, fx_amount: null },
    { id: 31, account_id: 1, posted_date: "2026-03-02", posted_time: "11:00:00", description: "salary deposit", debit: 0, credit: 500000, balance_after: 472675, kind: "salary", counts_as_spending: false, merchant_id: 5, merchant_name: "Salary Employer", category_id: null, category_name: null, fx_currency: null, fx_amount: null },
    { id: 30, account_id: 1, posted_date: "2026-03-01", posted_time: "08:30:00", description: "electricity bill", debit: 25000, credit: 0, balance_after: -27325, kind: "bill_payment", counts_as_spending: true, merchant_id: 4, merchant_name: "Electricity Company", category_id: 5, category_name: "Utilities", fx_currency: null, fx_amount: null },
    { id: 29, account_id: 1, posted_date: "2026-02-28", posted_time: "16:00:00", description: "coffee purchase", debit: 1750, credit: 0, balance_after: -2325, kind: "card_purchase", counts_as_spending: true, merchant_id: 3, merchant_name: "Coffee House", category_id: 4, category_name: "Dining", fx_currency: null, fx_amount: null },
    { id: 28, account_id: 1, posted_date: "2026-02-27", posted_time: "10:00:00", description: "grocery store", debit: 8900, credit: 0, balance_after: -575, kind: "card_purchase", counts_as_spending: true, merchant_id: 2, merchant_name: "Supermarket X", category_id: 3, category_name: "Groceries", fx_currency: null, fx_amount: null },
    { id: 27, account_id: 1, posted_date: "2026-02-26", posted_time: "13:15:00", description: "card payment", debit: 100000, credit: 0, balance_after: 8325, kind: "card_payment", counts_as_spending: false, merchant_id: null, merchant_name: null, category_id: null, category_name: null, fx_currency: null, fx_amount: null },
    { id: 26, account_id: 1, posted_date: "2026-02-25", posted_time: "09:30:00", description: "transfer out", debit: 50000, credit: 0, balance_after: 108325, kind: "external_transfer_out", counts_as_spending: false, merchant_id: null, merchant_name: null, category_id: null, category_name: null, fx_currency: null, fx_amount: null },
    { id: 25, account_id: 1, posted_date: "2026-02-24", posted_time: "11:00:00", description: "cash withdrawal", debit: 100000, credit: 0, balance_after: 158325, kind: "cash_withdrawal", counts_as_spending: true, merchant_id: null, merchant_name: null, category_id: null, category_name: null, fx_currency: null, fx_amount: null },
    ...Array.from({ length: 20 }, (_, i) => ({
      id: 24 - i,
      account_id: 1,
      posted_date: `2026-02-${String(23 - i).padStart(2, '0')}`,
      posted_time: "10:00:00",
      description: `transaction ${24 - i}`,
      debit: (i % 3 === 0) ? 0 : Math.floor(Math.random() * 50000) + 1000,
      credit: (i % 3 === 0) ? Math.floor(Math.random() * 50000) + 1000 : 0,
      balance_after: 200000 - i * 5000,
      kind: ["card_purchase", "online_purchase", "salary", "bill_payment", "fee"][i % 5],
      counts_as_spending: i % 3 !== 0,
      merchant_id: i % 2 === 0 ? (i % 5) + 1 : null,
      merchant_name: i % 2 === 0 ? merchants[(i % 5)].name : null,
      category_id: i % 2 === 0 ? (i % 5) + 1 : null,
      category_name: i % 2 === 0 ? ["Groceries", "Housing", "Utilities", "Dining", "Transport"][i % 5] : null,
      fx_currency: null,
      fx_amount: null,
    }))
  ];

  let filtered = transactions;

  if (merchantId) {
    filtered = filtered.filter(t => t.merchant_id === merchantId);
  }

  if (bucket === "spending") {
    filtered = filtered.filter(t => t.counts_as_spending && t.debit > 0);
  } else if (bucket === "income") {
    filtered = filtered.filter(t => t.credit > 0);
  } else if (bucket === "card_payments") {
    filtered = filtered.filter(t => t.kind === "card_payment");
  } else if (bucket === "transfers") {
    filtered = filtered.filter(t => t.kind.includes("transfer") || t.kind === "external_transfer_out");
  }

  const totalCount = filtered.length;
  const totalDebit = filtered.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = filtered.reduce((sum, t) => sum + t.credit, 0);
  const rows = filtered.slice(offset, offset + limit);

  return {
    rows,
    total_count: totalCount,
    total_debit: totalDebit,
    total_credit: totalCredit,
  };
};

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, BASE_URL);
  const pathname = url.pathname;

  // Health check endpoint
  if (pathname === "/healthz") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Readiness check endpoint
  if (pathname === "/readyz") {
    if (simulateReadyzUnavailable) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: "database unavailable" }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ready" }));
    return;
  }

  // Test control endpoint to toggle readyz unavailability
  if (pathname === "/__readyz-unavailable") {
    if (req.method === "POST") {
      simulateReadyzUnavailable = true;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "DELETE") {
      simulateReadyzUnavailable = false;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }
  }

  // Accounts endpoint
  if (pathname === "/api/accounts") {
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie;

    // Record the headers
    lastHeaders = {
      authorization: authHeader || null,
      cookie: cookieHeader || null,
    };

    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      accounts: [
        {
          id: 1,
          bank: "alinma",
          masked_number: "**********6060",
          kind: "current",
          currency: "SAR",
          balance: 118600,
          balance_date: "2026-03-31",
        },
        {
          id: 2,
          bank: "alrajhi",
          masked_number: "**********5432",
          kind: "credit_card",
          currency: "SAR",
          balance: 250000,
          balance_date: "2026-03-25",
        },
      ],
    }));
    return;
  }

  // Overview monthly endpoint
  if (pathname === "/api/overview/monthly") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      months: [
        {
          month: "2026-03",
          income: { salary: 500000, transfers_in: 0, refunds: 0, other: 0, total: 500000 },
          spending: { card_purchase: 4075, online_purchase: 1500, intl_purchase: 0, bill_payment: 375000, cash_withdrawal: 100000, fee: 0, total: 480575 },
          transfers: { internal: 0, external_out: 50000, roundup_sweeps: 0, total: 50000 },
          card_payments: 100000,
          uncategorised_spending: 0,
          outflow_total: 630575,
          credit_card_coverage: { card_payments: 100000, purchases_recorded: 5575, uncovered: 94425, uncovered_share: 0.944250 },
          transaction_count: 8,
        },
        {
          month: "2026-02",
          income: { salary: 500000, transfers_in: 10000, refunds: 0, other: 0, total: 510000 },
          spending: { card_purchase: 1750, online_purchase: 0, intl_purchase: 0, bill_payment: 25000, cash_withdrawal: 100000, fee: 0, total: 126750 },
          transfers: { internal: 0, external_out: 50000, roundup_sweeps: 0, total: 50000 },
          card_payments: 100000,
          uncategorised_spending: 0,
          outflow_total: 276750,
          credit_card_coverage: { card_payments: 100000, purchases_recorded: 1750, uncovered: 98250, uncovered_share: 0.982500 },
          transaction_count: 5,
        },
        {
          month: "2026-01",
          income: { salary: 500000, transfers_in: 0, refunds: 0, other: 0, total: 500000 },
          spending: { card_purchase: 2575, online_purchase: 1000, intl_purchase: 0, bill_payment: 50000, cash_withdrawal: 0, fee: 58, total: 53633 },
          transfers: { internal: 0, external_out: 0, roundup_sweeps: 0, total: 0 },
          card_payments: 1300,
          uncategorised_spending: 0,
          outflow_total: 54933,
          credit_card_coverage: { card_payments: 1300, purchases_recorded: 3575, uncovered: 0, uncovered_share: 0.0 },
          transaction_count: 7,
        },
        {
          month: "2025-12",
          income: { salary: 500000, transfers_in: 5000, refunds: 2500, other: 1200, total: 508700 },
          spending: { card_purchase: 12000, online_purchase: 5000, intl_purchase: 8000, bill_payment: 50000, cash_withdrawal: 75000, fee: 2500, total: 152500 },
          transfers: { internal: 10000, external_out: 15000, roundup_sweeps: 500, total: 25500 },
          card_payments: 85000,
          uncategorised_spending: 2500,
          outflow_total: 263000,
          credit_card_coverage: { card_payments: 85000, purchases_recorded: 25000, uncovered: 60000, uncovered_share: 0.705882 },
          transaction_count: 12,
        },
        {
          month: "2025-11",
          income: { salary: 500000, transfers_in: 8000, refunds: 0, other: 3000, total: 511000 },
          spending: { card_purchase: 10000, online_purchase: 4000, intl_purchase: 5000, bill_payment: 60000, cash_withdrawal: 80000, fee: 1500, total: 160500 },
          transfers: { internal: 15000, external_out: 20000, roundup_sweeps: 750, total: 35750 },
          card_payments: 90000,
          uncategorised_spending: 1500,
          outflow_total: 286250,
          credit_card_coverage: { card_payments: 90000, purchases_recorded: 19000, uncovered: 71000, uncovered_share: 0.788889 },
          transaction_count: 14,
        },
        {
          month: "2025-10",
          income: { salary: 500000, transfers_in: 0, refunds: 1000, other: 2500, total: 503500 },
          spending: { card_purchase: 8000, online_purchase: 3500, intl_purchase: 6000, bill_payment: 55000, cash_withdrawal: 70000, fee: 2000, total: 144500 },
          transfers: { internal: 12000, external_out: 18000, roundup_sweeps: 600, total: 30600 },
          card_payments: 80000,
          uncategorised_spending: 2000,
          outflow_total: 255100,
          credit_card_coverage: { card_payments: 80000, purchases_recorded: 17500, uncovered: 62500, uncovered_share: 0.781250 },
          transaction_count: 11,
        },
      ],
    }));
    return;
  }

  // Transactions endpoint
  if (pathname === "/api/transactions") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const bucket = url.searchParams.get("bucket") || "all";
    const merchantId = url.searchParams.get("merchant_id") ? parseInt(url.searchParams.get("merchant_id")) : null;

    const data = generateTransactions(offset, limit, bucket, merchantId);

    res.writeHead(200);
    res.end(JSON.stringify(data));
    return;
  }

  // Suggestions: card-coverage endpoint
  if (pathname === "/api/suggestions/card-coverage") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      period: { from: "2026-01", to: "2026-03" },
      summary: "Two of three months had card payments without matching purchase statements.",
      evidence: {
        months: [
          {
            month: "2026-03",
            card_payments: 100000,
            purchases_recorded: 5575,
            uncovered: 94425,
            uncovered_share: 0.944250,
            transaction_ids: [32, 33],
          },
          {
            month: "2026-02",
            card_payments: 100000,
            purchases_recorded: 1750,
            uncovered: 98250,
            uncovered_share: 0.982500,
            transaction_ids: [27],
          },
        ],
      },
      limits: "Does not account for manually entered card statements or categories.",
      next_step: "Import the card statement for Feb 2026.",
    }));
    return;
  }

  // Suggestions: recurring endpoint
  if (pathname === "/api/suggestions/recurring") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      period: { from: "2025-10", to: "2026-03" },
      summary: "Three recurring payments found. The largest is rent (SAR 3500.00/month).",
      evidence: {
        recurring_series: [
          {
            merchant: "Rent Agency",
            merchant_id: 1,
            occurrence_count: 6,
            distinct_months: 6,
            median_amount: 350000,
            total_amount: 2100000,
            first_date: "2025-10-03",
            last_date: "2026-03-03",
            cadence_days: 30,
            transaction_ids: [32, 100, 101, 102, 103, 104, 105, 106],
          },
          {
            merchant: "Electricity Company",
            merchant_id: 4,
            occurrence_count: 5,
            distinct_months: 5,
            median_amount: 25000,
            total_amount: 125000,
            first_date: "2025-10-05",
            last_date: "2026-03-01",
            cadence_days: 30,
            transaction_ids: [200, 201, 202, 203, 204],
          },
          {
            merchant: "Supermarket X",
            merchant_id: 2,
            occurrence_count: 4,
            distinct_months: 4,
            median_amount: 8900,
            total_amount: 35600,
            first_date: "2025-11-10",
            last_date: "2026-03-15",
            cadence_days: 26,
            transaction_ids: [28, 205, 206, 207],
          },
        ],
      },
      limits: "Recurring series must appear in at least 3 distinct months with stable amounts and consistent cadence.",
      next_step: "Review and categorize the recurring payments.",
    }));
    return;
  }

  // Suggestions: bnpl endpoint
  if (pathname === "/api/suggestions/bnpl") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (bnplVariant === "insufficient_data") {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: "insufficient_data",
        period: { from: "2025-10", to: "2026-03" },
        summary: "",
        evidence: {},
        limits: "BNPL identification requires at least 3 months of BNPL transactions.",
        next_step: "Import more statements to analyze BNPL spending trends.",
      }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: "ok",
        period: { from: "2025-10", to: "2026-03" },
        summary: "BNPL commitments are rising: SAR 4500.00 this month vs SAR 3500.00 average.",
        evidence: {
          months: [
            {
              month: "2026-03",
              bnpl_outflow: 4500,
              payment_count: 3,
              previous_month: 4000,
              three_month_average: 3500,
              is_rising: true,
              transaction_ids: [300, 301, 302],
            },
            {
              month: "2026-02",
              bnpl_outflow: 4000,
              payment_count: 2,
              previous_month: 3500,
              three_month_average: 3500,
              is_rising: true,
              transaction_ids: [303, 304],
            },
            {
              month: "2026-01",
              bnpl_outflow: 3500,
              payment_count: 3,
              previous_month: 3200,
              three_month_average: 3500,
              is_rising: true,
              transaction_ids: [305, 306, 307],
            },
          ],
        },
        limits: "BNPL identification uses known provider names (Tabby, Tamara, Postpay, Spotii, Cashew) and manual merchant tagging.",
        next_step: "Review upcoming BNPL payment dates and plan repayment.",
      }));
    }
    return;
  }

  // Control endpoint for BNPL variant
  if (pathname === "/__bnpl-variant") {
    if (req.method === "POST") {
      const variant = url.searchParams.get("variant") || "ok";
      bnplVariant = variant;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, variant: bnplVariant }));
      return;
    }
  }

  if (pathname === "/api/settings") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (req.method === "GET") {
      res.writeHead(200);
      res.end(JSON.stringify({ reminder_email: reminderEmail }));
      return;
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const value = typeof body.reminder_email === "string" ? body.reminder_email.trim() : "";

      if (!value || !value.includes("@")) {
        res.writeHead(422);
        res.end(JSON.stringify({ error: "invalid email address" }));
        return;
      }

      reminderEmail = value;
      res.writeHead(200);
      res.end(JSON.stringify({ reminder_email: reminderEmail }));
      return;
    }
  }

  if (pathname === "/api/settings/reminder/test" && req.method === "POST") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (!reminderEmail) {
      res.writeHead(422);
      res.end(JSON.stringify({ error: "no reminder email set" }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ sent: true }));
    return;
  }

  if (pathname === "/__reminder-email" && req.method === "DELETE") {
    reminderEmail = "";
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Last headers recording endpoint
  if (pathname === "/__last") {
    res.writeHead(200);
    res.end(JSON.stringify(lastHeaders));
    return;
  }

  // Import preview endpoint
  if (pathname === "/api/imports" && req.method === "POST") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const body = await readRawBody(req);
    const filename = /filename="([^"]*)"/.exec(body.toString("latin1"))?.[1] || "";

    res.writeHead(200);
    res.end(JSON.stringify(buildPreview(filename)));
    return;
  }

  // Clears import state between specs
  if (pathname === "/__imports" && req.method === "DELETE") {
    importedFiles.clear();
    importFileById.clear();
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Import commit endpoint
  if (pathname.startsWith("/api/imports/") && pathname.endsWith("/commit") && req.method === "POST") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const importId = parseInt(pathname.split("/")[3], 10);
    const filename = importFileById.get(importId);
    if (filename) {
      importedFiles.add(filename);
    }

    res.writeHead(200);
    res.end(JSON.stringify({ inserted: 3 }));
    return;
  }

  // Import cancel endpoint
  if (pathname.startsWith("/api/imports/") && req.method === "DELETE") {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Fake API listening on ${BASE_URL}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
