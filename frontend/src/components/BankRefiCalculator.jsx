// Calculadora simple de refinanciamiento bancario. Independiente del calculo
// BRRRR: estima el prestamo del banco, el pago mensual (amortizacion estandar)
// y el flujo mensual segun la renta. Calcula en vivo mientras se escribe.

import { useState } from "react";
import { formatMoney } from "../format.js";

const INICIAL = {
  property_value: "180000",
  ltv: "0.75",
  annual_rate: "0.07",
  term_years: "30",
  monthly_rent: "1500",
};

const CAMPOS = [
  { name: "property_value", label: "Valor tasado de la propiedad", ayuda: "$" },
  { name: "ltv", label: "LTV máximo del banco", ayuda: "0.75 = 75%" },
  { name: "annual_rate", label: "Tasa de interés anual", ayuda: "0.07 = 7%" },
  { name: "term_years", label: "Plazo del préstamo", ayuda: "años" },
  { name: "monthly_rent", label: "Renta mensual", ayuda: "$" },
];

const num = (v) => Number(v || 0);
const money = (n) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);

// Amortizacion hipotecaria estandar + flujo mensual con la renta.
function calcular(form) {
  const loanAmount = num(form.property_value) * num(form.ltv);
  const r = num(form.annual_rate) / 12; // tasa mensual
  const n = num(form.term_years) * 12; // cantidad de cuotas

  let monthly = 0;
  if (n > 0) {
    monthly =
      r === 0
        ? loanAmount / n
        : (loanAmount * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  }
  const totalPaid = monthly * n;
  const totalInterest = totalPaid - loanAmount;
  const cashFlow = num(form.monthly_rent) - monthly;

  return {
    loanAmount: money(loanAmount),
    monthly: money(monthly),
    totalPaid: money(totalPaid),
    totalInterest: money(Math.max(totalInterest, 0)),
    cashFlow: money(cashFlow),
    cashFlowPositivo: cashFlow >= 0,
  };
}

export default function BankRefiCalculator() {
  const [form, setForm] = useState(INICIAL);
  const r = calcular(form);

  function actualizar(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <section className="bank-calc">
      <div className="bank-head">
        <h2 className="section-header">Refinanciamiento bancario</h2>
        <button
          type="button"
          className="btn-reset"
          onClick={() => setForm(INICIAL)}
        >
          Reiniciar
        </button>
      </div>

      <div className="bank-inputs">
        {CAMPOS.map((campo) => (
          <label className="field" key={campo.name}>
            <span className="field-label">{campo.label}</span>
            <input
              inputMode="decimal"
              value={form[campo.name]}
              onChange={(e) => actualizar(campo.name, e.target.value)}
            />
            <span className="field-help">{campo.ayuda}</span>
          </label>
        ))}
      </div>

      <div className="bank-cards">
        <div className="bank-card">
          <span className="bank-card-label">Monto del préstamo</span>
          <span className="bank-card-value">{formatMoney(r.loanAmount)}</span>
        </div>
        <div className="bank-card destacada">
          <span className="bank-card-label">Pago mensual</span>
          <span className="bank-card-value">{formatMoney(r.monthly)}</span>
        </div>
        <div className="bank-card">
          <span className="bank-card-label">Interés total</span>
          <span className="bank-card-value">{formatMoney(r.totalInterest)}</span>
        </div>
      </div>

      <div className={"bank-flow " + (r.cashFlowPositivo ? "pos" : "neg")}>
        <span className="bank-flow-label">Flujo mensual (renta − pago)</span>
        <span className="bank-flow-value">{formatMoney(r.cashFlow)}</span>
      </div>

      <p className="bank-total">
        Total pagado en {form.term_years} años: {formatMoney(r.totalPaid)}
      </p>
    </section>
  );
}
