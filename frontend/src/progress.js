// Registro de gastos reales. Los montos se guardan como strings y se suman
// con centavos enteros (BigInt), sin perder precisión por coma flotante.

export const EXPENSE_CATEGORIES = [
  // Se conserva Compra para leer registros anteriores, no para nuevos gastos.
  { id: "purchase", label: "Compra (registro anterior)", color: "#7a6656", legacy: true },
  { id: "water", label: "Agua", color: "#5085a3" },
  { id: "electricity", label: "Luz", color: "#c49b20" },
  { id: "gas", label: "Gas", color: "#8a70ba" },
  { id: "materials", label: "Materiales adicionales", color: "#e8590c" },
  { id: "labor", label: "Mano de obra adicional", color: "#ffa05c" },
  { id: "rehab_other", label: "Otros adicionales de rehab", color: "#c2410c" },
  { id: "closing", label: "Cierre y trámites", color: "#8a70ba" },
  { id: "financing", label: "Intereses y financiamiento", color: "#5085a3" },
  { id: "utilities", label: "Servicios y mantenimiento", color: "#419d75" },
  { id: "other", label: "Otros gastos", color: "#a08b7a" },
];

export const EXTRA_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.filter((category) => !category.legacy);

export function normalizeReference(reference = {}, rehabBudget = "0.00") {
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    throw new Error("No se pudieron leer los datos originales de la casa.");
  }
  const budget = normalizeAmount(rehabBudget, { allowZero: true });
  if (reference.rehab_budget != null
    && normalizeAmount(reference.rehab_budget, { allowZero: true }) !== budget) {
    throw new Error("El rehab original no coincide con el registrado para esta casa.");
  }
  const copy = { rehab_budget: budget };
  for (const key of ["purchase_price", "arv", "loan_total", "closing_fee"]) {
    copy[key] = reference[key] == null ? null : normalizeAmount(reference[key], { allowZero: true });
  }
  if (reference.ltv == null) {
    copy.ltv = null;
  } else {
    const percent = String(reference.ltv).trim().replace(",", ".");
    if (!/^\d{1,3}(?:\.\d{1,6})?$/.test(percent)) {
      throw new Error("No se pudo leer el LTV original de la casa.");
    }
    copy.ltv = percent;
  }
  return copy;
}

export function progressDealFromSaved(saved) {
  if (!saved?.id || !saved.form) throw new Error("Elegí un deal guardado para iniciar el seguimiento.");
  const fields = validateProgressDeal({
    name: saved.name || saved.form.name || "Casa sin nombre",
    address: saved.form.address || "",
    rehabBudget: saved.form.rehab_budget || "0",
  });
  return {
    ...fields,
    sourceDealId: saved.id,
    reference: normalizeReference(saved.form, fields.rehabBudget),
  };
}

export function normalizeAmount(value, { allowZero = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,12}(?:[.,]\d{1,2})?$/.test(raw)) {
    throw new Error("Usá un monto sin separador de miles y con hasta dos decimales.");
  }
  const [whole, fraction = ""] = raw.replace(",", ".").split(".");
  const amount = `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
  if (!allowZero && amountToCents(amount) === 0n) {
    throw new Error("El monto del gasto debe ser mayor que cero.");
  }
  return amount;
}

function amountToCents(amount) {
  const [whole, fraction = "00"] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction);
}

function centsToAmount(cents) {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function summarizeProgress(deal) {
  const totals = new Map(EXPENSE_CATEGORIES.map((category) => [category.id, 0n]));
  for (const expense of deal.expenses) {
    totals.set(expense.category, totals.get(expense.category) + amountToCents(expense.amount));
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0n);
  const purchase = deal.reference?.purchase_price;
  const base = purchase == null ? null : amountToCents(purchase) + amountToCents(deal.rehabBudget);
  return {
    totalSpent: centsToAmount(total),
    baseCost: base === null ? null : centsToAmount(base),
    totalWithExtras: base === null ? null : centsToAmount(base + total),
    categoryTotals: EXPENSE_CATEGORIES.map((category) => ({
      ...category,
      amount: centsToAmount(totals.get(category.id)),
    })).filter((category) => totals.get(category.id) > 0n),
  };
}

export function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function validateExpense(input) {
  const description = String(input.description ?? "").trim();
  if (!description || description.length > 200) {
    throw new Error("Indicá un concepto de hasta 200 caracteres.");
  }
  if (!EXPENSE_CATEGORIES.some((category) => category.id === input.category)) {
    throw new Error("Elegí una categoría válida.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) {
    throw new Error("Indicá una fecha válida.");
  }
  const parsedDate = new Date(`${input.date}T00:00:00Z`);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.date) {
    throw new Error("Indicá una fecha válida.");
  }
  const vendor = String(input.vendor ?? "").trim();
  const payer = String(input.payer ?? "").trim();
  const notes = String(input.notes ?? "").trim();
  if (vendor.length > 120 || payer.length > 120 || notes.length > 1000) {
    throw new Error("Los nombres admiten 120 caracteres y la nota hasta 1.000.");
  }
  return {
    description,
    category: input.category,
    date: input.date,
    amount: normalizeAmount(input.amount),
    vendor,
    payer,
    notes,
  };
}

export function validateProgressDeal(input) {
  const name = String(input.name ?? "").trim();
  const address = String(input.address ?? "").trim();
  if (!name || name.length > 200) {
    throw new Error("Indicá un nombre para la casa de hasta 200 caracteres.");
  }
  if (address.length > 300) {
    throw new Error("La dirección admite hasta 300 caracteres.");
  }
  return {
    name,
    address,
    rehabBudget: normalizeAmount(input.rehabBudget || "0", { allowZero: true }),
  };
}
