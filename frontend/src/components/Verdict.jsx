// Tarjeta de veredicto: dinero atrapado en grande, chip de cambio vs. el deal
// base, termometro de display y metricas al pie.

import { formatMoney } from "../format.js";
import { useAnimatedNumber } from "../useAnimatedNumber.js";

const UMBRAL = 5000;

function veredicto(trappedStr) {
  const atrapado = Number(trappedStr);
  if (atrapado <= 0) {
    return { color: "var(--color-bueno)", colorSuave: "#CDEFD9", chip: "El deal sirve" };
  }
  if (atrapado <= UMBRAL) {
    return { color: "#E8590C", colorSuave: "#FFD9BF", chip: "Al límite" };
  }
  return { color: "var(--color-malo)", colorSuave: "#F8CFCF", chip: "No sirve" };
}

// Recupero = cash out / total invertido, en %. Calculo de display.
function recupero(cashOut, totalInvested) {
  const invertido = Number(totalInvested);
  if (!invertido) return "—";
  return `${Math.round((Number(cashOut) / invertido) * 100)}%`;
}

export default function Verdict({ result, baseTrapped, onDeshacer }) {
  const v = veredicto(result.trapped_cash);
  const animado = useAnimatedNumber(Number(result.trapped_cash));

  // Chip de cambio vs. el deal base.
  const actual = Number(result.trapped_cash);
  const diff = actual - Number(baseTrapped);
  const hayCambio = Math.abs(diff) >= 1;

  // Termometro (geometria de display).
  const escala = Math.max(Math.abs(actual) * 1.3, UMBRAL * 4, 20000);
  const naranjaW = (UMBRAL / escala) * 50;
  const rojaW = 50 - naranjaW;
  const markerLeft = Math.min(98, Math.max(2, 50 + (actual / escala) * 50));

  return (
    <section className="verdict" style={{ borderColor: v.colorSuave }}>
      <div className="verdict-top">
        <span className="verdict-kicker">Dinero atrapado</span>
        <span className="verdict-chip" style={{ background: v.color }}>
          {v.chip}
        </span>
      </div>

      <div className="verdict-amount" style={{ color: v.color }}>
        {formatMoney(animado.toFixed(2))}
      </div>

      {hayCambio ? (
        <div className="cambio-row">
          <span className={"cambio-pill " + (diff < 0 ? "baja" : "sube")}>
            {diff < 0 ? "↓ " : "↑ "}
            {formatMoney(Math.abs(diff).toFixed(2))} {diff < 0 ? "menos" : "más"} que
            al empezar
          </span>
          <button type="button" className="deshacer-link" onClick={onDeshacer}>
            Deshacer cambios
          </button>
        </div>
      ) : (
        <p className="recalc-note">Se recalcula mientras escribís</p>
      )}

      <div className="termo">
        <div className="termo-track">
          <div className="termo-bar">
            <div className="termo-zona verde" style={{ flexGrow: 50 }} />
            <div className="termo-zona naranja" style={{ flexGrow: naranjaW }} />
            <div className="termo-zona roja" style={{ flexGrow: rojaW }} />
          </div>
          <div
            className="termo-marker"
            style={{ left: `${markerLeft}%`, borderColor: v.color }}
          />
        </div>
        <div className="termo-labels">
          <span>Sobra capital</span>
          <span>$0</span>
          <span>Queda atrapado</span>
        </div>
      </div>

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
