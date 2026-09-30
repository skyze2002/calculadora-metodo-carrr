// Panel izquierdo: formulario del deal. No hace aritmetica; solo recolecta.
// Los porcentajes se ingresan como fraccion (0.90 = 90%).

// Campos agrupados en tres secciones del dominio.
const SECCIONES = [
  {
    titulo: "Propiedad",
    campos: [
      { name: "purchase_price", label: "Precio de compra", ayuda: "$" },
      { name: "rehab_budget", label: "Presupuesto de rehab", ayuda: "$" },
      { name: "arv", label: "ARV", ayuda: "$" },
    ],
  },
  {
    titulo: "Prestamista privado",
    campos: [
      { name: "loan_total", label: "Total del préstamo", ayuda: "$" },
      { name: "closing_fee", label: "Costes de cierre", ayuda: "$" },
    ],
  },
  {
    titulo: "Refi con el banco",
    campos: [
      { name: "ltv", label: "LTV", ayuda: "0.75 = 75%" },
    ],
  },
];

function Campo({ campo, valor, onChange }) {
  return (
    <label className="field">
      <span className="field-label">{campo.label}</span>
      <input
        inputMode="decimal"
        value={valor}
        onChange={(e) => onChange(campo.name, e.target.value)}
      />
      <span className="field-help">{campo.ayuda}</span>
    </label>
  );
}

export default function DealForm({
  form,
  onChange,
  onSubmit,
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
          Los porcentajes van como fracción (0.90 = 90%). Cargá los datos y tocá
          Evaluar para ver cuánto capital queda atrapado.
        </p>
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
