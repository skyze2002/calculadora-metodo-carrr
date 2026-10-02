// Hipoteca del banco: estima el prestamo, la cuota (amortizacion estandar), el
// flujo con la renta y el reparto capital vs. intereses. Calcula en vivo.

import { useState } from "react";
import {
  cleanPercent,
  formatMoney,
  formatThousands,
  onlyDigits,
} from "../format.js";

const INICIAL = {
  property_value: "180000",
  ltv: "75",
  annual_rate: "7",
  term_years: "30",
  monthly_rent: "1500",
};

// Inputs (sin el plazo, que va como control segmentado).
const CAMPOS = [
  { name: "property_value", label: "Valor tasado de la propiedad", kind: "money", ayuda: "$" },
  { name: "ltv", label: "LTV máximo del banco", kind: "percent", ayuda: "%" },
  { name: "annual_rate", label: "Tasa de interés anual", kind: "percent", ayuda: "% anual" },
  { name: "monthly_rent", label: "Renta mensual", kind: "money", ayuda: "$" },
];

const PLAZOS = [15, 20, 30];

const num = (v) => Number(v || 0);
const money = (n) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);

function calcular(form) {
  const loanAmount = num(form.property_value) * (num(form.ltv) / 100);
  const r = num(form.annual_rate) / 100 / 12;
  const n = num(form.term_years) * 12;

  let monthly = 0;
  if (n > 0) {
    monthly =
      r === 0
        ? loanAmount / n
        : (loanAmount * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  }
  const totalPaid = monthly * n;
  const totalInterest = Math.max(totalPaid - loanAmount, 0);
  const cashFlow = num(form.monthly_rent) - monthly;

  return {
    loanAmount: money(loanAmount),
    monthly: money(monthly),
    totalPaid: money(totalPaid),
    totalInterest: money(totalInterest),
    cashFlow: money(cashFlow),
    cashFlowPositivo: cashFlow >= 0,
    capW: totalPaid > 0 ? (loanAmount / totalPaid) * 100 : 0,
  };
}

export default function BankRefiCalculator({ arvActual }) {
  const [form, setForm] = useState(INICIAL);
  const r = calcular(form);

  function actualizar(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function mostrar(campo) {
    if (campo.kind === "money") return formatThousands(form[campo.name]);
    return form[campo.name];
  }
  function cambiar(campo, value) {
    if (campo.kind === "money") actualizar(campo.name, onlyDigits(value));
    else if (campo.kind === "percent") actualizar(campo.name, cleanPercent(value));
    else actualizar(campo.name, value);
  }

  // Reiniciar: vuelve a los defaults pero precarga el valor tasado con el ARV.
  function reiniciar() {
    setForm({ ...INICIAL, property_value: onlyDigits(arvActual) || INICIAL.property_value });
  }

  return (
    <section className="bank-calc">
      <div className="section-head">
        <span className="section-num">04</span>
        <h2 className="section-title">Hipoteca del banco</h2>
        <button type="button" className="reiniciar-link" onClick={reiniciar}>
          Reiniciar
        </button>
      </div>

      <div className="bank-inputs">
        {CAMPOS.map((campo) => (
          <label className="field" key={campo.name}>
            <span className="field-label">{campo.label}</span>
            <input
              className="field-input"
              inputMode="decimal"
              value={mostrar(campo)}
              onChange={(e) => cambiar(campo, e.target.value)}
            />
            <span className="field-help">{campo.ayuda}</span>
          </label>
        ))}
      </div>

      <div className="field">
        <span className="field-label">Plazo del préstamo</span>
        <div className="ltv-chips">
          {PLAZOS.map((p) => (
            <button
              type="button"
              key={p}
              className={"ltv-chip" + (num(form.term_years) === p ? " active" : "")}
              onClick={() => actualizar("term_years", String(p))}
            >
              {p} años
            </button>
          ))}
        </div>
      </div>

      <div className="bank-cards bank-cards-2">
        <div className="bank-card">
          <span className="bank-card-label">Monto del préstamo</span>
          <span className="bank-card-value">{formatMoney(r.loanAmount)}</span>
        </div>
        <div className="bank-card destacada">
          <span className="bank-card-label">Cuota mensual</span>
          <span className="bank-card-value">{formatMoney(r.monthly)}</span>
        </div>
      </div>

      <div className={"bank-flow " + (r.cashFlowPositivo ? "pos" : "neg")}>
        <span className="bank-flow-label">Flujo mensual (renta − cuota)</span>
        <span className="bank-flow-value">{formatMoney(r.cashFlow)}</span>
      </div>

      <div className="banco-bar-wrap">
        <div className="banco-bar">
          <div className="banco-seg capital" style={{ width: `${r.capW}%` }} />
          <div className="banco-seg interes" style={{ width: `${100 - r.capW}%` }} />
        </div>
        <div className="banco-bar-legend">
          <span>
            <i className="sw cap" /> Capital {formatMoney(r.loanAmount)}
          </span>
          <span>
            <i className="sw int" /> Intereses {formatMoney(r.totalInterest)}
          </span>
        </div>
        <p className="bank-total">
          Total en {form.term_years} años: {formatMoney(r.totalPaid)}
        </p>
      </div>
    </section>
  );
}
