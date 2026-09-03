// Waterfall: dos tramos con barra apilada. Los anchos son geometria de
// presentacion (divs), no calculo de plata: los montos que se muestran salen
// tal cual de la API. closing_costs es un input, viene del deal evaluado.

import { formatMoney } from "../format.js";

// Porcentaje de una parte sobre el total del tramo (para el ancho del segmento).
function porcentaje(parte, total) {
  const base = Number(total);
  if (!base) return 0;
  return (Number(parte) / base) * 100;
}

function Tramo({ titulo, total, ancho, segmentos }) {
  return (
    <div className="tramo">
      <div className="tramo-head">
        <span className="tramo-title">{titulo}</span>
        <span className="tramo-total">{formatMoney(total)}</span>
      </div>

      <div className="bar-scale" style={{ width: `${ancho}%` }}>
        <div className="bar">
          {segmentos.map((s) => (
            <div
              key={s.label}
              className="bar-seg"
              style={{ width: `${s.w}%`, background: s.color }}
            />
          ))}
        </div>
      </div>

      <div className="legend">
        {segmentos.map((s) => (
          <div className="legend-row" key={s.label}>
            <span className="legend-swatch" style={{ background: s.color }} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-fill" />
            <span className="legend-amount">{formatMoney(s.monto)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Waterfall({ result, closingCosts }) {
  // Las dos barras comparten escala: el ancho de cada tramo es su total sobre el
  // mayor de los dos totales, con un piso de 12% para que se lean comparables.
  const escala =
    Math.max(Number(result.total_cost), Number(result.refinance_loan_amount)) || 1;
  const anchoTramo = (total) => Math.max((Number(total) / escala) * 100, 12);

  const tramo1 = {
    titulo: "Con que se compra y se repara",
    total: result.total_cost,
    ancho: anchoTramo(result.total_cost),
    segmentos: [
      {
        label: "Prestamo privado",
        monto: result.private_loan_amount,
        color: "var(--color-accent-700)",
        w: porcentaje(result.private_loan_amount, result.total_cost),
      },
      {
        label: "Aporte inicial",
        monto: result.down_payment,
        color: "var(--color-accent-400)",
        w: porcentaje(result.down_payment, result.total_cost),
      },
    ],
  };

  // cash_out se clampea a >= 0 solo para el ancho de la barra.
  const cashOutBarra = Math.max(0, Number(result.cash_out));
  const tramo2 = {
    titulo: "A donde va el prestamo del refi",
    total: result.refinance_loan_amount,
    ancho: anchoTramo(result.refinance_loan_amount),
    segmentos: [
      {
        label: "Payoff",
        monto: result.payoff,
        color: "var(--color-accent-700)",
        w: porcentaje(result.payoff, result.refinance_loan_amount),
      },
      {
        label: "Costos de cierre",
        monto: closingCosts,
        color: "var(--color-neutral-700)",
        w: porcentaje(closingCosts, result.refinance_loan_amount),
      },
      {
        label: "Cash out",
        monto: result.cash_out,
        color: "var(--color-bueno)",
        w: porcentaje(cashOutBarra, result.refinance_loan_amount),
      },
    ],
  };

  return (
    <section className="card waterfall">
      <Tramo {...tramo1} />
      <Tramo {...tramo2} />
    </section>
  );
}
