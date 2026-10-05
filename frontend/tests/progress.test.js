import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAmount, summarizeProgress, validateExpense } from "../src/progress.js";

test("los montos aceptan coma o punto y conservan centavos exactos", () => {
  assert.equal(normalizeAmount(" 1250,5 "), "1250.50");
  assert.equal(normalizeAmount("00012.01"), "12.01");
  const summary = summarizeProgress({
    rehabBudget: "1.00",
    reference: { purchase_price: "100.00" },
    expenses: [
      { amount: "0.10", category: "materials" },
      { amount: "0.20", category: "labor" },
    ],
  });
  assert.equal(summary.totalSpent, "0.30");
  assert.equal(summary.baseCost, "101.00");
  assert.equal(summary.totalWithExtras, "101.30");
});

test("agua, luz y otros adicionales se suman sin modificar la compra ni el rehab", () => {
  const deal = {
    rehabBudget: "2000.00",
    reference: { purchase_price: "100000.00" },
    expenses: [
      { amount: "50.30", category: "water" },
      { amount: "75.20", category: "electricity" },
      { amount: "150.00", category: "materials" },
    ],
  };
  const summary = summarizeProgress(deal);
  assert.equal(summary.totalSpent, "275.50");
  assert.equal(summary.baseCost, "102000.00");
  assert.equal(summary.totalWithExtras, "102275.50");
  assert.equal(deal.rehabBudget, "2000.00");
  assert.equal(deal.reference.purchase_price, "100000.00");
  assert.equal(summary.categoryTotals.find((category) => category.id === "water").amount, "50.30");
});

test("si falta el precio original se muestran los adicionales sin inventar un costo base", () => {
  const summary = summarizeProgress({
    rehabBudget: "0.00",
    expenses: [{ amount: "100.00", category: "materials" }],
  });
  assert.equal(summary.baseCost, null);
  assert.equal(summary.totalWithExtras, null);
  assert.equal(summary.totalSpent, "100.00");
});

test("el rehab original nunca se cuenta como un pago adicional", () => {
  assert.equal(summarizeProgress({ rehabBudget: "30000.00", expenses: [] }).totalSpent, "0.00");
});

test("los montos inválidos se rechazan en vez de alterar silenciosamente su valor", () => {
  for (const value of ["", "0", "-20", "1.234", "1.250,50", "NaN", "Infinity", "1e5", "1000000000000"]) {
    assert.throws(() => normalizeAmount(value), Error);
  }
  assert.equal(normalizeAmount("0", { allowZero: true }), "0.00");
});

test("los montos grandes se suman sin redondeo de coma flotante", () => {
  const summary = summarizeProgress({
    rehabBudget: "0.00",
    reference: { purchase_price: "999999999999.99" },
    expenses: [
      { amount: "999999999999.99", category: "materials" },
      { amount: "0.01", category: "labor" },
    ],
  });
  assert.equal(summary.totalSpent, "1000000000000.00");
  assert.equal(summary.baseCost, "999999999999.99");
  assert.equal(summary.totalWithExtras, "1999999999999.99");
});

test("los gastos necesitan concepto, categoría y una fecha real", () => {
  const expense = { description: " Cemento ", category: "materials", amount: "25,50", date: "2026-10-03" };
  assert.equal(validateExpense(expense).description, "Cemento");
  assert.equal(validateExpense(expense).amount, "25.50");
  assert.throws(() => validateExpense({ ...expense, description: " " }));
  assert.throws(() => validateExpense({ ...expense, category: "unknown" }));
  assert.throws(() => validateExpense({ ...expense, date: "2026-02-30" }));
  assert.throws(() => validateExpense({ ...expense, date: "fecha" }));
});

test("quién pagó es opcional y se conserva por separado del proveedor", () => {
  const expense = { description: "Agua", category: "water", amount: "25", date: "2026-10-03", vendor: "Servicio de agua" };
  assert.equal(validateExpense(expense).payer, "");
  const result = validateExpense({ ...expense, payer: " Persona de ejemplo " });
  assert.equal(result.payer, "Persona de ejemplo");
  assert.equal(result.vendor, "Servicio de agua");
  assert.throws(() => validateExpense({ ...expense, payer: "a".repeat(121) }));
});
