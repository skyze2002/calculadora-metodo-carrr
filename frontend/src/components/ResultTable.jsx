// Detalle completo del resultado, plegable (7 líneas).

import { useState } from "react";
import { formatMoney } from "../format.js";

const FILAS = [
  ["total_cost", "Costo total"],
  ["private_loan_amount", "Total del préstamo"],
  ["down_payment", "Aporte inicial"],
  ["refinance_loan_amount", "Préstamo del refi"],
  ["payoff", "Pago al prestamista"],
  ["cash_out", "Dinero devuelto por el banco"],
  ["total_invested", "Total invertido"],
];

export default function ResultTable({ result }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <section className="card detalle">
      <div className="detalle-head">
        <span className="detalle-title">Detalle completo</span>
        <button
          type="button"
          className="detalle-toggle"
          onClick={() => setAbierto((a) => !a)}
        >
          {abierto ? "Ocultar" : "Ver las 7 líneas"}
        </button>
      </div>

      {abierto && (
        <table className="result-table">
          <tbody>
            {FILAS.map(([key, label]) => (
              <tr key={key}>
                <td>{label}</td>
                <td>{formatMoney(result[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
