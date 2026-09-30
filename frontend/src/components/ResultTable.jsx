// Tabla con las ocho lineas del resultado (sin trapped_cash: ya esta arriba).

import { formatMoney } from "../format.js";

const FILAS = [
  ["private_loan_amount", "Total del préstamo"],
  ["down_payment", "Aporte inicial"],
  ["refinance_loan_amount", "Préstamo del refi"],
  ["cash_out", "Dinero devuelto por el banco"],
  ["total_invested", "Total invertido"],
];

export default function ResultTable({ result }) {
  return (
    <section className="card">
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
    </section>
  );
}
