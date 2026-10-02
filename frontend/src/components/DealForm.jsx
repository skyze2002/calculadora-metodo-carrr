// Panel izquierdo: formulario del deal. No hace aritmetica; solo recolecta.
// Los montos se muestran con separador de miles; los porcentajes como 75, 7.

import { cleanPercent, formatThousands, onlyDigits } from "../format.js";
import PhotoImport from "./PhotoImport.jsx";
import UrlImport from "./UrlImport.jsx";

// Campos agrupados en tres secciones del dominio. kind: money | percent.
const SECCIONES = [
  {
    titulo: "Propiedad",
    campos: [
      { name: "purchase_price", label: "Precio de compra", kind: "money", ayuda: "$" },
      { name: "rehab_budget", label: "Presupuesto de rehab", kind: "money", ayuda: "$" },
      { name: "arv", label: "ARV", kind: "money", ayuda: "$" },
    ],
  },
  {
    titulo: "Prestamista privado",
    campos: [
      { name: "loan_total", label: "Total del préstamo", kind: "money", ayuda: "$" },
      { name: "closing_fee", label: "Costes de cierre", kind: "money", ayuda: "$" },
    ],
  },
  {
    titulo: "Refi con el banco",
    campos: [{ name: "ltv", label: "LTV", kind: "percent", ayuda: "%" }],
  },
];

function Campo({ campo, valor, onChange }) {
  let display = valor;
  let handle = (v) => onChange(campo.name, v);

  if (campo.kind === "money") {
    display = formatThousands(valor);
    handle = (v) => onChange(campo.name, onlyDigits(v));
  } else if (campo.kind === "percent") {
    handle = (v) => onChange(campo.name, cleanPercent(v));
  }

  return (
    <label className="field">
      <span className="field-label">{campo.label}</span>
      <input
        inputMode="decimal"
        value={display}
        onChange={(e) => handle(e.target.value)}
      />
      <span className="field-help">{campo.ayuda}</span>
    </label>
  );
}

export default function DealForm({
  form,
  onChange,
  onSubmit,
  onExtracted,
  cargando,
  dirty,
  evaluatedName,
}) {
  return (
    <form className="form-panel" onSubmit={onSubmit}>
      <header>
        <span className="form-kicker">
          <span className="form-kicker-dot" />
          Calculadora BRRRR
        </span>
        <h1 className="form-title">El deal</h1>
        <p className="form-intro">
          Cargá los datos del deal y tocá Evaluar para ver cuánto capital queda
          atrapado. O autocompletalos con IA desde una foto o el link de un aviso.
        </p>
        <UrlImport onExtracted={onExtracted} />
        <PhotoImport onExtracted={onExtracted} />
      </header>

      <label className="field field-name">
        <span className="field-label">Nombre del deal</span>
        <input value={form.name} onChange={(e) => onChange("name", e.target.value)} />
      </label>

      <div className="form-sections">
        {SECCIONES.map((seccion) => (
          <section className="section" key={seccion.titulo}>
            <h2 className="section-header">{seccion.titulo}</h2>
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
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="evaluate-row">
        <button className="btn-primary" type="submit" disabled={cargando}>
          {cargando ? "Evaluando…" : "Evaluar deal"}
        </button>
        <span className={"evaluate-status" + (dirty ? " dirty" : "")}>
          {dirty
            ? "Cambios sin evaluar"
            : evaluatedName
              ? `Evaluado · ${evaluatedName}`
              : ""}
        </span>
      </div>
    </form>
  );
}
