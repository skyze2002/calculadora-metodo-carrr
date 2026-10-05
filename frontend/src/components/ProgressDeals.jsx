// Seguimiento por casa: datos originales fijos e historial de pagos adicionales.

import { useState } from "react";
import "../progress.css";
import { formatMoney } from "../format.js";
import {
  EXPENSE_CATEGORIES,
  EXTRA_EXPENSE_CATEGORIES,
  localDate,
  progressDealFromSaved,
  summarizeProgress,
  validateExpense,
} from "../progress.js";

function dateLabel(date) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function OriginalDealDetails({ deal }) {
  const reference = deal.reference ?? {};
  const fields = [
    ["Precio de compra", reference.purchase_price],
    ["Rehab original", deal.rehabBudget],
    ["ARV original", reference.arv],
    ["Préstamo privado", reference.loan_total],
    ["Costes de cierre originales", reference.closing_fee],
  ];
  return (
    <section className="progress-card progress-original">
      <div className="progress-card-head">
        <h2>Datos originales de la casa</h2>
        <span className="progress-fixed-badge">Datos fijos</span>
      </div>
      <dl className="progress-original-grid">
        {fields.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value == null ? "Sin dato" : formatMoney(value)}</dd></div>
        ))}
        <div><dt>LTV original</dt><dd>{reference.ltv == null ? "Sin dato" : `${reference.ltv}%`}</dd></div>
      </dl>
      <p className="progress-note">Estos valores quedan fijos. Los pagos adicionales se registran por separado.</p>
    </section>
  );
}

function SavedDealPicker({ savedDeals, progressDeals, onSave, onCancel }) {
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState(null);
  const saved = savedDeals.find((deal) => deal.id === selectedId);
  let preview = null;
  let previewError = null;
  if (saved) {
    try {
      preview = progressDeals.find((deal) => deal.sourceDealId === saved.id) ?? progressDealFromSaved(saved);
    } catch (err) {
      previewError = err.message;
    }
  }

  function submit(event) {
    event.preventDefault();
    setError(null);
    try {
      if (!preview) throw new Error(previewError || "Elegí una casa guardada.");
      onSave(preview);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="progress-card progress-project-form" onSubmit={submit} noValidate>
      <h2>Elegir un deal guardado</h2>
      <label className="field">
        <span className="field-label">Casa para registrar gastos adicionales</span>
        <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setError(null); }}>
          <option value="">Elegí una casa</option>
          {savedDeals.map((deal) => <option key={deal.id} value={deal.id}>{deal.name || "Sin nombre"}</option>)}
        </select>
      </label>
      {preview && <OriginalDealDetails deal={preview} />}
      {(error || previewError) && <p className="progress-error" role="alert">{error || previewError}</p>}
      <div className="progress-form-actions">
        <button className="progress-primary" type="submit">Iniciar seguimiento</button>
        <button className="progress-secondary" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function ExpenseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial ?? {
    description: "", amount: "", date: localDate(), category: "water", vendor: "", payer: "", notes: "",
  });
  const [error, setError] = useState(null);
  const change = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  function submit(event) {
    event.preventDefault();
    setError(null);
    try {
      const expense = validateExpense(form);
      onSave(expense);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="progress-card progress-expense-form" onSubmit={submit} noValidate>
      <div className="progress-card-head">
        <div>
          <span className="progress-kicker">Pago adicional</span>
          <h2>{initial ? "Editar gasto adicional" : "Agregar un gasto adicional"}</h2>
        </div>
        <span className="progress-form-symbol" aria-hidden="true">{initial ? "✎" : "+"}</span>
      </div>
      <label className="field">
        <span className="field-label">Concepto *</span>
        <input value={form.description} maxLength={200} required placeholder="Ej. Recibo de agua de octubre"
          onChange={(event) => change("description", event.target.value)} />
      </label>
      <div className="progress-form-grid">
        <label className="field">
          <span className="field-label">Monto ($) *</span>
          <input inputMode="decimal" value={form.amount} required placeholder="Ej. 1250,50"
            onChange={(event) => change("amount", event.target.value)} />
          <span className="field-help">Sin separador de miles; hasta dos decimales.</span>
        </label>
        <label className="field">
          <span className="field-label">Fecha del pago *</span>
          <input type="date" value={form.date} required
            onChange={(event) => change("date", event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Categoría *</span>
        <select value={form.category} onChange={(event) => change("category", event.target.value)}>
          {EXTRA_EXPENSE_CATEGORIES.concat(EXPENSE_CATEGORIES.filter((category) => category.legacy && initial?.category === category.id))
            .map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Quién pagó (opcional)</span>
        <input value={form.payer ?? ""} maxLength={120} placeholder="Nombre de la persona que hizo el pago"
          onChange={(event) => change("payer", event.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Proveedor o contratista (opcional)</span>
        <input value={form.vendor} maxLength={120} placeholder="A quién le pagaste"
          onChange={(event) => change("vendor", event.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Nota (opcional)</span>
        <textarea value={form.notes} maxLength={1000} rows={2} placeholder="Detalle del trabajo, factura o referencia"
          onChange={(event) => change("notes", event.target.value)} />
      </label>
      {error && <p className="progress-error" role="alert">{error}</p>}
      <div className="progress-form-actions">
        <button className="progress-primary" type="submit">{initial ? "Guardar gasto" : "Agregar gasto"}</button>
        {initial && <button className="progress-secondary" type="button" onClick={onCancel}>Cancelar edición</button>}
      </div>
    </form>
  );
}

function ProjectDetail({ deal, onBack, onExpenseSave, onExpenseDelete }) {
  const summary = summarizeProgress(deal);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formVersion, setFormVersion] = useState(0);
  const [confirming, setConfirming] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [message, setMessage] = useState("");
  const expenses = [...deal.expenses]
    .filter((expense) => !categoryFilter || expense.category === categoryFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  function saveExpense(fields) {
    if (onExpenseSave(deal.id, fields, editingExpense?.id)) {
      setMessage(editingExpense ? "Gasto actualizado." : "Gasto registrado.");
      setEditingExpense(null);
      setFormVersion((version) => version + 1);
    }
  }

  function editExpense(expense) {
    setEditingExpense(expense);
    setConfirming(null);
    setMessage("");
    document.getElementById("progress-entry")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteExpense(id) {
    if (onExpenseDelete(deal.id, id)) {
      setConfirming(null);
      setMessage("Gasto eliminado del historial.");
      if (editingExpense?.id === id) setEditingExpense(null);
    }
  }

  return (
    <>
      <button className="progress-back" type="button" onClick={onBack}>← Todas las casas</button>
      <div className="progress-heading">
        <div>
          <span className="progress-kicker">Deal en progreso</span>
          <h1>{deal.name}</h1>
          {deal.address && <p className="progress-subtitle">{deal.address}</p>}
        </div>
      </div>
      <OriginalDealDetails deal={deal} />
      <div className="progress-metrics">
        <div className="progress-metric featured">
          <span>Gastos adicionales registrados</span>
          <strong>{formatMoney(summary.totalSpent)}</strong>
          <small>{deal.expenses.length} {deal.expenses.length === 1 ? "pago registrado" : "pagos registrados"}</small>
        </div>
        <div className="progress-metric">
          <span>Costo base de la casa</span>
          <strong>{summary.baseCost == null ? "—" : formatMoney(summary.baseCost)}</strong>
          <small>{summary.baseCost == null ? "Precio original no disponible" : "Compra + rehab original, sin cambios"}</small>
        </div>
        <div className="progress-metric">
          <span>Total con adicionales</span>
          <strong>{summary.totalWithExtras == null ? "—" : formatMoney(summary.totalWithExtras)}</strong>
          <small>{summary.totalWithExtras == null ? "Precio original no disponible" : "Costo base + gastos adicionales"}</small>
        </div>
      </div>
      <div className="progress-feedback" role="status" aria-live="polite">{message}</div>
      <div className="progress-detail-grid">
        <div id="progress-entry">
          <ExpenseForm key={`${editingExpense?.id ?? "new"}-${formVersion}`} initial={editingExpense}
            onSave={saveExpense} onCancel={() => setEditingExpense(null)} />
        </div>
        <div className="progress-history-col">
          <section className="progress-card">
            <div className="progress-card-head">
              <h2>Gastos adicionales</h2>
              <span className="progress-count">{deal.expenses.length}</span>
            </div>
            {deal.expenses.length > 0 && (
              <label className="field progress-filter">
                <span className="field-label">Filtrar por categoría</span>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">Todas las categorías</option>
                  {EXTRA_EXPENSE_CATEGORIES.concat(EXPENSE_CATEGORIES.filter((category) => category.legacy
                    && deal.expenses.some((expense) => expense.category === category.id)))
                    .map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
                </select>
              </label>
            )}
            {expenses.length === 0 ? (
              <p className="progress-empty-history">{deal.expenses.length
                ? "No hay gastos en esta categoría."
                : "Todavía no hay gastos adicionales. Agregá un pago de agua, luz u otro gasto cuando lo hagas."}</p>
            ) : (
              <ul className="progress-expenses" aria-label="Historial de gastos">
                {expenses.map((expense) => {
                  const category = EXPENSE_CATEGORIES.find((item) => item.id === expense.category);
                  return (
                    <li className="progress-expense" key={expense.id}>
                      <div className="progress-expense-date">
                        <time dateTime={expense.date}>{dateLabel(expense.date)}</time>
                        <span className="progress-category" style={{ color: category.color }}>{category.label}</span>
                      </div>
                      <div className="progress-expense-info">
                        <strong>{expense.description}</strong>
                        {expense.payer && <span>Pagó: {expense.payer}</span>}
                        {expense.vendor && <span>Proveedor: {expense.vendor}</span>}
                        {expense.notes && <p>{expense.notes}</p>}
                      </div>
                      <strong className="progress-expense-amount">{formatMoney(expense.amount)}</strong>
                      <div className="progress-expense-actions">
                        {confirming === expense.id ? (
                          <>
                            <span className="progress-delete-prompt">¿Eliminar este gasto?</span>
                            <button type="button" className="progress-text-button danger"
                              onClick={() => deleteExpense(expense.id)}>Confirmar eliminación</button>
                            <button type="button" className="progress-text-button" onClick={() => setConfirming(null)}>Cancelar</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="progress-text-button" onClick={() => editExpense(expense)}
                              aria-label={`Editar gasto: ${expense.description}`}>Editar</button>
                            <button type="button" className="progress-text-button danger" onClick={() => setConfirming(expense.id)}
                              aria-label={`Eliminar gasto: ${expense.description}`}>Eliminar</button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {summary.categoryTotals.length > 0 && (
            <section className="progress-card">
              <h2>Gastos por categoría</h2>
              <ul className="progress-category-totals">
                {summary.categoryTotals.map((category) => (
                  <li key={category.id}>
                    <span className="progress-category-dot" style={{ background: category.color }} />
                    <span>{category.label}</span>
                    <strong>{formatMoney(category.amount)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default function ProgressDeals({ deals, savedDeals, selectedId, error, onSelect, onCreate,
  onIrCalculadora, onExpenseSave, onExpenseDelete }) {
  const [creating, setCreating] = useState(false);
  const selected = deals.find((deal) => deal.id === selectedId);

  return (
    <main className="progress-view">
      {error && <p className="progress-error" role="alert">{error}</p>}
      {selected ? (
        <ProjectDetail key={selected.id} deal={selected} onBack={() => onSelect(null)}
          onExpenseSave={onExpenseSave} onExpenseDelete={onExpenseDelete} />
      ) : (
        <>
          <div className="progress-heading">
            <div>
              <span className="progress-kicker">Control de pagos adicionales</span>
              <h1>Deals en progreso</h1>
              <p className="progress-subtitle">Los datos de la casa quedan fijos. Agregá agua, luz y otros pagos.</p>
            </div>
            {!creating && <button className="progress-primary" type="button"
              onClick={() => savedDeals.length ? setCreating(true) : onIrCalculadora()}>
              {savedDeals.length ? "+ Agregar deal guardado" : "Ir a la calculadora"}
            </button>}
          </div>
          {creating && <SavedDealPicker savedDeals={savedDeals} progressDeals={deals} onCancel={() => setCreating(false)} onSave={(fields) => {
            if (onCreate(fields)) setCreating(false);
          }} />}
          {deals.length === 0 && !creating ? (
            <div className="progress-empty">
              <div className="progress-house-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2>Empezá con una casa guardada</h2>
              <p>El precio, el rehab y los demás datos del deal se mantienen fijos. Después podés agregar gastos adicionales y quién los pagó.</p>
              <button className="progress-primary" type="button"
                onClick={() => savedDeals.length ? setCreating(true) : onIrCalculadora()}>
                {savedDeals.length ? "Elegir deal guardado" : "Ir a la calculadora"}
              </button>
            </div>
          ) : (
            <div className="progress-projects">
              {deals.map((deal) => {
                const summary = summarizeProgress(deal);
                return (
                  <button className="progress-project-card" type="button" key={deal.id}
                    onClick={() => onSelect(deal.id)} aria-label={`Ver gastos de ${deal.name}`}>
                    <span className="progress-project-top"><span className="progress-project-status">En progreso</span><span aria-hidden="true">↗</span></span>
                    <strong className="progress-project-name">{deal.name}</strong>
                    {deal.address && <span className="progress-project-address">{deal.address}</span>}
                    <span className="progress-project-total-label">Gastos adicionales</span>
                    <strong className="progress-project-total">{formatMoney(summary.totalSpent)}</strong>
                    <span className="progress-project-footer">
                      <span>{deal.expenses.length} {deal.expenses.length === 1 ? "pago" : "pagos"}</span>
                      <span>Datos originales fijos</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      <p className="progress-storage-note">Guardado en este dispositivo. Los gastos adicionales no cambian los datos originales del deal.</p>
    </main>
  );
}
