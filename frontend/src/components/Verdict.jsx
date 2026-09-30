// Tarjeta de veredicto: el dinero atrapado en grande, un chip, una frase que
// dice que hacer, y tres metricas al pie.

import { formatMoney } from "../format.js";

// Umbral (en pesos) para el estado intermedio "al limite".
const UMBRAL = 5000;

// Decide color, chip y texto segun el dinero atrapado. La comparacion con el
// umbral es una decision de presentacion (que mensaje mostrar), no un calculo
// de plata: los montos que se muestran salen tal cual de la API.
function veredicto(trappedStr) {
  const atrapado = Number(trappedStr);
  const monto = formatMoney(trappedStr);
  if (atrapado <= 0) {
    return {
      color: "var(--color-bueno)",
      colorSuave: "#CDEFD9",
      chip: "El deal sirve",
      texto:
        "El refi devuelve todo lo que pusiste. El capital queda libre para el próximo deal.",
    };
  }
  if (atrapado <= UMBRAL) {
    return {
      color: "#E8590C",
      colorSuave: "#FFD9BF",
      chip: "Al límite",
      texto: `Quedan ${monto} inmovilizados. Negociá LTC o bajá el rehab para acercarlo a cero.`,
    };
  }
  return {
    color: "var(--color-malo)",
    colorSuave: "#F8CFCF",
    chip: "No sirve",
    texto: `Quedan ${monto} inmovilizados: demasiado capital atado a esta propiedad.`,
  };
}

// Recupero = cash out / total invertido, en %. Unico calculo de display
// permitido en el front (regla 4). Se protege la division por cero.
function recupero(cashOut, totalInvested) {
  const invertido = Number(totalInvested);
  if (!invertido) return "—";
  return `${Math.round((Number(cashOut) / invertido) * 100)}%`;
}

export default function Verdict({ result }) {
  const v = veredicto(result.trapped_cash);
  return (
    <section className="verdict" style={{ borderColor: v.colorSuave }}>
      <div className="verdict-top">
        <span className="verdict-kicker">Dinero atrapado</span>
        <span className="verdict-chip" style={{ background: v.color }}>
          {v.chip}
        </span>
      </div>

      <div className="verdict-amount" style={{ color: v.color }}>
        {formatMoney(result.trapped_cash)}
      </div>

      <p className="verdict-text">{v.texto}</p>

      <div className="verdict-foot">
        <div className="verdict-metric">
          <span className="label">Total invertido</span>
          <span className="value">{formatMoney(result.total_invested)}</span>
        </div>
        <div className="verdict-metric">
          <span className="label">Dinero devuelto</span>
          <span className="value">{formatMoney(result.cash_out)}</span>
        </div>
        <div className="verdict-metric">
          <span className="label">Recupero</span>
          <span className="value">
            {recupero(result.cash_out, result.total_invested)}
          </span>
        </div>
      </div>
    </section>
  );
}
