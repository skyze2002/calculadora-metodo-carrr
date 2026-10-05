// Historial de pagos independiente de los deals de la calculadora.
// Una escritura fallida no devuelve éxito ni reemplaza los datos en memoria.

import { normalizeReference, validateExpense, validateProgressDeal } from "./progress.js";

const KEY = "brrrr_progress_v1";

function storage() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // El navegador puede denegar el acceso al almacenamiento.
  }
  throw new Error("No se puede acceder al guardado en este dispositivo.");
}

export function getProgressDeals(savedDeals = []) {
  let raw;
  try {
    raw = storage().getItem(KEY);
  } catch {
    throw new Error("No se pudieron leer tus gastos en este dispositivo. Probá recargar la app.");
  }
  if (raw === null) return [];
  let deals;
  let upgraded = false;
  try {
    deals = JSON.parse(raw);
    if (!Array.isArray(deals)) throw new Error();
    const ids = new Set();
    deals = deals.map((deal) => {
      if (!deal || typeof deal.id !== "string" || !deal.id || ids.has(deal.id)
        || typeof deal.name !== "string" || typeof deal.address !== "string"
        || !Array.isArray(deal.expenses)) throw new Error();
      ids.add(deal.id);
      const fields = validateProgressDeal(deal);
      if (typeof deal.rehabBudget !== "string" || fields.rehabBudget !== deal.rehabBudget
        || typeof deal.createdAt !== "string") throw new Error();
      let original = deal.reference;
      if (original === undefined) {
        // Migración aditiva: captura lo disponible y conserva el rehab y pagos.
        const saved = savedDeals.find((item) => item.id === deal.sourceDealId);
        original = { ...saved?.form, rehab_budget: deal.rehabBudget };
        upgraded = true;
      }
      const reference = normalizeReference(original, deal.rehabBudget);
      const expenseIds = new Set();
      const expenses = deal.expenses.map((expense) => {
        if (!expense || typeof expense.id !== "string" || !expense.id
          || expenseIds.has(expense.id) || typeof expense.amount !== "string"
          || !["description", "date", "vendor", "notes", "createdAt"].every((key) => typeof expense[key] === "string")
          || (expense.payer !== undefined && typeof expense.payer !== "string")) throw new Error();
        expenseIds.add(expense.id);
        const fields = validateExpense(expense);
        if (fields.amount !== expense.amount || typeof expense.createdAt !== "string") throw new Error();
        if (expense.payer === undefined) upgraded = true;
        return { ...expense, payer: fields.payer };
      });
      return { ...deal, reference, expenses };
    });
  } catch {
    // No sobrescribir un historial ilegible con una lista vacía.
    throw new Error("No se pudo leer el historial de gastos. Los datos guardados se conservaron.");
  }
  return upgraded ? persist(deals) : deals;
}

function persist(deals) {
  try {
    storage().setItem(KEY, JSON.stringify(deals));
  } catch {
    throw new Error("No se pudo guardar. Revisá el espacio o los permisos del navegador e intentá de nuevo.");
  }
  return deals;
}

function newId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createProgressDeal(input) {
  const fields = validateProgressDeal(input);
  const deals = getProgressDeals();
  if (input.sourceDealId) {
    const existing = deals.find((deal) => deal.sourceDealId === input.sourceDealId);
    if (existing) return { deal: existing, deals };
  }
  const deal = {
    id: newId(),
    ...fields,
    reference: normalizeReference(input.reference, fields.rehabBudget),
    sourceDealId: input.sourceDealId || null,
    createdAt: new Date().toISOString(),
    expenses: [],
  };
  return { deal, deals: persist([deal, ...deals]) };
}

function modifyDeal(id, transform) {
  const deals = getProgressDeals();
  if (!deals.some((deal) => deal.id === id)) {
    throw new Error("No se encontró esa casa. Recargá la app para actualizar la lista.");
  }
  return persist(deals.map((deal) => deal.id === id ? transform(deal) : deal));
}

export function addProgressExpense(id, input) {
  const fields = validateExpense(input);
  if (fields.category === "purchase") {
    throw new Error("La compra es un dato original de la casa. Registrá sólo gastos adicionales.");
  }
  const expense = { id: newId(), ...fields, createdAt: new Date().toISOString() };
  return modifyDeal(id, (deal) => ({ ...deal, expenses: [expense, ...deal.expenses] }));
}

export function updateProgressExpense(id, expenseId, input) {
  const fields = validateExpense(input);
  return modifyDeal(id, (deal) => {
    const existing = deal.expenses.find((expense) => expense.id === expenseId);
    if (!existing) {
      throw new Error("No se encontró ese gasto. Recargá la app para actualizar el historial.");
    }
    if (fields.category === "purchase" && existing.category !== "purchase") {
      throw new Error("La compra es un dato original de la casa. Registrá sólo gastos adicionales.");
    }
    return {
      ...deal,
      expenses: deal.expenses.map((expense) => expense.id === expenseId
        ? { ...expense, ...fields } : expense),
    };
  });
}

export function deleteProgressExpense(id, expenseId) {
  return modifyDeal(id, (deal) => ({
    ...deal,
    expenses: deal.expenses.filter((expense) => expense.id !== expenseId),
  }));
}
