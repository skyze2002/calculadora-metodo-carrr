import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  addProgressExpense,
  createProgressDeal,
  deleteProgressExpense,
  getProgressDeals,
  updateProgressExpense,
} from "../src/progressStorage.js";
import { progressDealFromSaved } from "../src/progress.js";

let records;
beforeEach(() => {
  records = new Map();
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
});

const expense = {
  description: "Pintura", category: "materials", amount: "25,50", date: "2026-10-03", vendor: "Ferretería",
};

test("crear, editar y eliminar un gasto persiste el historial de su casa", () => {
  const { deal } = createProgressDeal({ name: "Casa A", rehabBudget: "2000", reference: { purchase_price: "100000" } });
  let deals = addProgressExpense(deal.id, expense);
  const id = deals[0].expenses[0].id;
  assert.equal(getProgressDeals()[0].expenses[0].amount, "25.50");
  deals = updateProgressExpense(deal.id, id, {
    ...expense, amount: "30", description: "Pintura exterior", payer: "Persona de ejemplo",
    name: "No debe cambiar", rehabBudget: "1", reference: { purchase_price: "1" },
  });
  assert.equal(deals[0].expenses[0].id, id);
  assert.equal(getProgressDeals()[0].expenses[0].amount, "30.00");
  assert.equal(getProgressDeals()[0].expenses.length, 1);
  assert.equal(getProgressDeals()[0].expenses[0].payer, "Persona de ejemplo");
  assert.equal(getProgressDeals()[0].name, "Casa A");
  assert.equal(getProgressDeals()[0].rehabBudget, "2000.00");
  assert.deepEqual(getProgressDeals()[0].reference, deal.reference);
  deleteProgressExpense(deal.id, id);
  assert.equal(getProgressDeals()[0].expenses.length, 0);
  assert.deepEqual(getProgressDeals()[0].reference, deal.reference);
});

test("los gastos de dos casas permanecen separados", () => {
  const a = createProgressDeal({ name: "Casa A" }).deal;
  const b = createProgressDeal({ name: "Casa B" }).deal;
  addProgressExpense(a.id, expense);
  const deals = getProgressDeals();
  assert.equal(deals.find((deal) => deal.id === a.id).expenses.length, 1);
  assert.equal(deals.find((deal) => deal.id === b.id).expenses.length, 0);
});

test("iniciar desde el mismo deal guardado reutiliza el seguimiento y conserva los pagos", () => {
  const input = { name: "Casa guardada", sourceDealId: "saved-1", rehabBudget: "30000" };
  const first = createProgressDeal(input);
  addProgressExpense(first.deal.id, expense);
  const second = createProgressDeal(input);
  assert.equal(second.deal.id, first.deal.id);
  assert.equal(second.deals.length, 1);
  assert.equal(second.deal.expenses.length, 1);
});

test("los datos originales son una copia fija aunque el deal guardado cambie después", () => {
  const saved = {
    id: "saved-1", name: "Casa guardada",
    form: { purchase_price: "100000", rehab_budget: "30000", arv: "180000", loan_total: "100000", closing_fee: "10000", ltv: "75" },
  };
  const first = createProgressDeal(progressDealFromSaved(saved));
  saved.form.purchase_price = "90000";
  saved.form.rehab_budget = "20000";
  saved.name = "Otro nombre";
  const second = createProgressDeal(progressDealFromSaved(saved));
  assert.equal(second.deal.id, first.deal.id);
  assert.equal(second.deal.name, "Casa guardada");
  assert.equal(second.deal.reference.purchase_price, "100000.00");
  assert.equal(second.deal.reference.arv, "180000.00");
  assert.equal(second.deal.reference.ltv, "75");
  assert.equal(second.deal.rehabBudget, "30000.00");
  assert.deepEqual(getProgressDeals()[0].reference, first.deal.reference);
});

test("los pagos antiguos se conservan y reciben quién pagó vacío al migrar", () => {
  const legacy = {
    id: "legacy-1", name: "Casa guardada", address: "", rehabBudget: "30000.00",
    sourceDealId: "saved-1", createdAt: "2026-10-03T00:00:00Z",
    expenses: [{ id: "old-expense", ...expense, amount: "25.50", notes: "Nota anterior", createdAt: "2026-10-03T00:00:00Z" }],
  };
  records.set("brrrr_progress_v1", JSON.stringify([legacy]));
  const saved = { id: "saved-1", form: { purchase_price: "100000", rehab_budget: "40000", arv: "180000" } };
  const migrated = getProgressDeals([saved]);
  assert.equal(migrated[0].expenses.length, 1);
  assert.equal(migrated[0].expenses[0].id, "old-expense");
  assert.equal(migrated[0].expenses[0].amount, "25.50");
  assert.equal(migrated[0].expenses[0].notes, "Nota anterior");
  assert.equal(migrated[0].expenses[0].payer, "");
  assert.equal(migrated[0].rehabBudget, "30000.00");
  assert.equal(migrated[0].reference.purchase_price, "100000.00");
  saved.form.purchase_price = "1";
  assert.equal(getProgressDeals([saved])[0].reference.purchase_price, "100000.00");
});

test("se registran agua y luz como adicionales y no se vuelve a cargar la compra", () => {
  const { deal } = createProgressDeal({ name: "Casa A", rehabBudget: "2000", reference: { purchase_price: "100000" } });
  addProgressExpense(deal.id, { ...expense, category: "water", payer: "Persona de ejemplo" });
  addProgressExpense(deal.id, { ...expense, category: "electricity" });
  assert.equal(getProgressDeals()[0].expenses.length, 2);
  assert.throws(() => addProgressExpense(deal.id, { ...expense, category: "purchase" }), /dato original/);
  const expenseId = getProgressDeals()[0].expenses[0].id;
  assert.throws(() => updateProgressExpense(deal.id, expenseId, { ...expense, category: "purchase" }), /dato original/);
  assert.equal(getProgressDeals()[0].reference.purchase_price, "100000.00");
});

test("un fallo de almacenamiento no devuelve éxito ni altera los pagos anteriores", () => {
  const { deal } = createProgressDeal({ name: "Casa A" });
  globalThis.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => addProgressExpense(deal.id, expense), /No se pudo guardar/);
  assert.equal(getProgressDeals()[0].expenses.length, 0);
});

test("un historial corrupto se conserva y bloquea sobrescrituras", () => {
  records.set("brrrr_progress_v1", "{invalid");
  assert.throws(() => getProgressDeals(), /se conservaron/);
  assert.throws(() => createProgressDeal({ name: "Nueva casa" }), /se conservaron/);
  assert.equal(records.get("brrrr_progress_v1"), "{invalid");
});

test("los campos guardados inválidos se detectan antes de sumar", () => {
  const { deal } = createProgressDeal({ name: "Casa A" });
  const deals = addProgressExpense(deal.id, expense);
  deals[0].expenses[0].amount = "25.5";
  records.set("brrrr_progress_v1", JSON.stringify(deals));
  assert.throws(() => getProgressDeals(), /se conservaron/);
});

test("un gasto inválido o una casa inexistente no crean registros", () => {
  const { deal } = createProgressDeal({ name: "Casa A" });
  assert.throws(() => addProgressExpense(deal.id, { ...expense, amount: "-5" }));
  assert.throws(() => addProgressExpense("unknown", expense), /No se encontró esa casa/);
  assert.equal(getProgressDeals()[0].expenses.length, 0);
});

test("un historial con textos dañados no llega a la interfaz ni se sobrescribe", () => {
  const { deals } = createProgressDeal({ name: "Casa A" });
  deals[0].name = { invalid: true };
  const damaged = JSON.stringify(deals);
  records.set("brrrr_progress_v1", damaged);
  assert.throws(() => getProgressDeals(), /se conservaron/);
  assert.equal(records.get("brrrr_progress_v1"), damaged);
});
