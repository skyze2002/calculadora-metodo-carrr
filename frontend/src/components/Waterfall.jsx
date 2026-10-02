// Waterfall: dos tramos con barra apilada. Los anchos son geometria de
// presentacion (divs), no calculo de plata. Hover resalta un segmento.

import { useState } from "react";
import { formatMoney } from "../format.js";

function porcentaje(parte, total) {
  const base = Number(total);
  if (!base) return 0;
  return (Number(parte) / base) * 100;
}

function Tramo({ titulo, total, ancho, segmentos }) {
  const [hover, setHover] = useState(null);
  return (
    <div className="tramo">
      <div className="tramo-head">
        <span className="tramo-title">{titulo}</span>
        <span className="tramo-total">{formatMoney(total)}</span>
      </div>

      <div className="bar-scale" style={{ width: `${ancho}%` }}>
        <div className="bar">
          {segmentos.map((s, i) => (
            <div
              key={s.label}
              className="bar-seg"
              style={{
                width: `${s.w}%`,
                background: s.color,
                opacity: hover !== null && hover !== i ? 0.35 : 1,
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
      </div>

      <div className="legend">
        {segmentos.map((s, i) => (
          <div
            key={s.label}
            className={"legend-row" + (hover === i ? " activa" : "")}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="legend-swatch" style={{ background: s.color }} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-fill" />
            <span className="legend-pct">{Math.round(s.w)}%</span>
            <span className="legend-amount">{formatMoney(s.monto)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Waterfall({ result }) {
  const escala =
    Math.max(Number(result.total_cost), Number(result.refinance_loan_amount)) || 1;
  const anchoTramo = (total) => Math.max((Number(total) / escala) * 100, 12);

  const tramo1 = {
    titulo: "Con qué se compra y se repara",
    total: result.total_cost,
    ancho: anchoTramo(result.total_cost),
    segmentos: [
      {
        label: "Préstamo privado",
        monto: result.private_loan_amount,
        color: "#C2410C",
        w: porcentaje(result.private_loan_amount, result.total_cost),
      },
      {
        label: "Tu aporte",
        monto: result.down_payment,
        color: "#FFA05C",
        w: porcentaje(result.down_payment, result.total_cost),
      },
    ],
  };

  const cashOutBarra = Math.max(0, Number(result.cash_out));
  const tramo2 = {
    titulo: "A dónde va el préstamo del refi",
    total: result.refinance_loan_amount,
    ancho: anchoTramo(result.refinance_loan_amount),
    segmentos: [
      {
        label: "Pago al prestamista",
        monto: result.payoff,
        color: "#C2410C",
        w: porcentaje(result.payoff, result.refinance_loan_amount),
      },
      {
        label: "Vuelve a tu bolsillo",
        monto: result.cash_out,
        color: "#22B36B",
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
