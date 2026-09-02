// Formulario del deal + vista de resultados.
// REGLA 4: el frontend NO hace aritmetica. Arma el payload, lo manda a
// POST /deals/evaluate y muestra tal cual los montos (string) que devuelve.

import { useState } from "react";
import { evaluateDeal } from "./api.js";
import { formatMoney } from "./format.js";
import "./styles.css";

// Valores iniciales = el deal de ejemplo acordado. Los porcentajes van como
// fraccion (0.90 = 90%) porque el front no convierte nada.
const INICIAL = {
  name: "Casa ejemplo",
  purchase_price: "100000",
  rehab_budget: "30000",
  arv: "180000",
  ltc: "0.90",
  monthly_interest_rate: "0.005",
  points: "0.02",
  ltv: "0.75",
  seasoning_months: "6",
  closing_costs: "4000",
};

// Definicion de los campos del formulario, para no repetir markup.
const CAMPOS = [
  { name: "name", label: "Nombre del deal", tipo: "text" },
  { name: "purchase_price", label: "Precio de compra", ayuda: "$" },
  { name: "rehab_budget", label: "Presupuesto de rehab", ayuda: "$" },
  { name: "arv", label: "ARV (valor reparado)", ayuda: "$" },
  { name: "ltc", label: "LTC", ayuda: "fraccion, ej 0.90 = 90%" },
  {
    name: "monthly_interest_rate",
    label: "Interes mensual",
    ayuda: "fraccion, ej 0.005 = 0,5%",
  },
  { name: "points", label: "Puntos", ayuda: "fraccion, ej 0.02 = 2%" },
  { name: "ltv", label: "LTV del refi", ayuda: "fraccion, ej 0.75 = 75%" },
  { name: "seasoning_months", label: "Seasoning (meses)", ayuda: "meses" },
  { name: "closing_costs", label: "Costos de cierre del refi", ayuda: "$" },
];

// Como se muestran los resultados. El dinero atrapado es la metrica clave.
const RESULTADOS = [
  { key: "private_loan_amount", label: "Prestamo privado" },
  { key: "down_payment", label: "Aporte inicial" },
  { key: "points_amount", label: "Puntos" },
  { key: "monthly_interest", label: "Interes mensual (informativo)" },
  { key: "payoff", label: "Payoff al prestamista" },
  { key: "refinance_loan_amount", label: "Prestamo del refi" },
  { key: "cash_out", label: "Cash out del banco" },
  { key: "total_invested", label: "Total invertido" },
];

export default function App() {
  const [form, setForm] = useState(INICIAL);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  function actualizar(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function calcular(evento) {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const data = await evaluateDeal(form);
      setResultado(data);
    } catch (err) {
      setError(err.message);
      setResultado(null);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="contenedor">
      <h1>Calculadora BRRRR</h1>
      <p className="intro">
        Evalua cuanto capital queda atrapado despues de refinanciar. Mientras el
        dinero atrapado este mas cerca de cero, mejor el deal.
      </p>

      <form className="grilla" onSubmit={calcular}>
        {CAMPOS.map((campo) => (
          <label key={campo.name} className="campo">
            <span className="etiqueta">{campo.label}</span>
            <input
              type={campo.tipo ?? "text"}
              inputMode={campo.tipo === "text" ? undefined : "decimal"}
              value={form[campo.name]}
              onChange={(e) => actualizar(campo.name, e.target.value)}
            />
            {campo.ayuda && <span className="ayuda">{campo.ayuda}</span>}
          </label>
        ))}

        <button className="boton" type="submit" disabled={cargando}>
          {cargando ? "Calculando..." : "Calcular"}
        </button>
      </form>

      {error && <p className="error">Error: {error}</p>}

      {resultado && (
        <section className="resultado">
          <table>
            <tbody>
              {RESULTADOS.map((fila) => (
                <tr key={fila.key}>
                  <td>{fila.label}</td>
                  <td className="monto">{formatMoney(resultado[fila.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            className={
              "atrapado " +
              (Number(resultado.trapped_cash) <= 0 ? "bueno" : "malo")
            }
          >
            <span className="etiqueta">Dinero atrapado</span>
            <span className="valor">{formatMoney(resultado.trapped_cash)}</span>
          </div>
        </section>
      )}
    </main>
  );
}
