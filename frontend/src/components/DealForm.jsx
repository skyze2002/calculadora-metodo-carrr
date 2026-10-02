// Panel izquierdo: formulario del deal. No hace aritmetica de plata; los montos
// (costo total, prestamo) salen del result. Las notas/hints en % son display.

import { formatMoney } from "../format.js";
import DealImport from "./DealImport.jsx";
import LtvField from "./LtvField.jsx";
import MoneyField from "./MoneyField.jsx";

// Campos agrupados en tres secciones del dominio. kind: money (con step) | ltv.
const SECCIONES = [
  {
    titulo: "Propiedad",
    campos: [
      { name: "purchase_price", label: "Precio de compra", kind: "money", step: 1000 },
      { name: "rehab_budget", label: "Presupuesto de rehab", kind: "money", step: 500 },
      { name: "arv", label: "ARV", kind: "money", step: 1000 },
    ],
  },
  {
    titulo: "Prestamista privado",
    campos: [
      { name: "loan_total", label: "Total del préstamo", kind: "money", step: 1000 },
      { name: "closing_fee", label: "Costes de cierre", kind: "money", step: 500 },
    ],
  },
  {
    titulo: "Refi con el banco",
    campos: [{ name: "ltv", label: "LTV", kind: "ltv" }],
  },
];

const n = (v) => Number(v || 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Nota contextual a la derecha del titulo de cada seccion.
function notaSeccion(titulo, form, result) {
  if (titulo === "Propiedad") return `Costo total ${formatMoney(result.total_cost)}`;
  if (titulo === "Prestamista privado")
    return `Financia ${pct(n(form.loan_total), n(result.total_cost))}% del costo`;
  if (titulo === "Refi con el banco")
    return `Préstamo ${formatMoney(result.refinance_loan_amount)}`;
  return "";
}

// Hint a la derecha del label de algunos campos (solo porcentaje de display).
function hintCampo(name, form) {
  const compra = n(form.purchase_price);
  if (name === "rehab_budget") return `${pct(n(form.rehab_budget), compra)}% de la compra`;
  if (name === "arv") {
    const d = compra ? Math.round(((n(form.arv) - compra) / compra) * 100) : 0;
    return `${d >= 0 ? "+" : ""}${d}% vs. compra`;
  }
  return null;
}

function Campo({ campo, valor, onChange, hint, resaltado }) {
  const set = (v) => onChange(campo.name, v);
  return (
    <div className={"field-card" + (resaltado ? " resaltado" : "")}>
      <div className="field-top">
        <span className="field-label">{campo.label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </div>
      {campo.kind === "ltv" ? (
        <LtvField value={valor} onChange={set} />
      ) : (
        <MoneyField value={valor} onChange={set} step={campo.step} />
      )}
    </div>
  );
}

export default function DealForm({
  form,
  onChange,
  onExtracted,
  result,
  resaltados = [],
}) {
  return (
    <div className="form-panel">
      <div className={"deal-title" + (resaltados.includes("name") ? " resaltado" : "")}>
        <span className="deal-title-label">Deal</span>
        <input
          className="deal-title-input"
          value={form.name}
          placeholder="Nombre del deal"
          onChange={(e) => onChange("name", e.target.value)}
        />
      </div>

      <DealImport onExtracted={onExtracted} />

      <div className="form-sections">
        {SECCIONES.map((seccion, i) => (
          <section className="section" key={seccion.titulo}>
            <div className="section-head">
              <span className="section-num">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="section-title">{seccion.titulo}</h2>
              <span className="section-note">
                {notaSeccion(seccion.titulo, form, result)}
              </span>
            </div>
            <div
              className={
                "section-fields" +
                (seccion.campos.length === 1
                  ? " single"
                  : seccion.campos.length === 2
                    ? " two"
                    : "")
              }
            >
              {seccion.campos.map((campo) => (
                <Campo
                  key={campo.name}
                  campo={campo}
                  valor={form[campo.name]}
                  onChange={onChange}
                  hint={hintCampo(campo.name, form)}
                  resaltado={resaltados.includes(campo.name)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
