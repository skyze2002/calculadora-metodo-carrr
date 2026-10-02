// Barra flotante inferior (solo celular, vista Calculadora): estado del dinero
// atrapado + guardar + ver resultado. Se oculta en escritorio por CSS.

import { formatMoney } from "../format.js";

function estado(trapped) {
  const t = Number(trapped);
  if (t <= 0) return { chip: "El deal sirve", color: "#7FE0A8" };
  if (t <= 5000) return { chip: "Al límite", color: "#FFA05C" };
  return { chip: "No sirve", color: "#FF8A8A" };
}

export default function FloatingBar({ trapped, onGuardar, guardado, onVer }) {
  const e = estado(trapped);
  return (
    <div className="floatbar">
      <div className="floatbar-info">
        <span className="floatbar-label">Atrapado · {e.chip}</span>
        <span className="floatbar-amount" style={{ color: e.color }}>
          {formatMoney(trapped)}
        </span>
      </div>
      <div className="floatbar-actions">
        <button type="button" className="floatbar-guardar" onClick={onGuardar}>
          {guardado ? "✓" : "Guardar"}
        </button>
        <button type="button" className="floatbar-ver" onClick={onVer}>
          Ver
        </button>
      </div>
    </div>
  );
}
