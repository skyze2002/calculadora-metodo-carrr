// Apartado de deals guardados: resumen, orden, fila-tarjeta con estado, y
// borrado con confirmacion en dos toques.

import { useState } from "react";
import { formatMoney } from "../format.js";

const UMBRAL = 5000;

function estado(trappedStr) {
  const t = Number(trappedStr);
  if (t <= 0) return { color: "var(--color-bueno)", chip: "Sirve", sirve: true };
  if (t <= UMBRAL) return { color: "#E8590C", chip: "Al límite", sirve: false };
  return { color: "var(--color-malo)", chip: "No sirve", sirve: false };
}

export default function SavedDeals({ deals, onAbrir, onEliminar, onIrCalculadora }) {
  const [orden, setOrden] = useState("recientes");
  const [confirmando, setConfirmando] = useState(null);

  const sirven = deals.filter((d) => Number(d.trapped) <= 0).length;

  const lista = [...deals];
  if (orden === "mejores") {
    lista.sort((a, b) => Number(a.trapped) - Number(b.trapped));
  }

  function clickEliminar(id) {
    if (confirmando === id) {
      onEliminar(id);
      setConfirmando(null);
    } else {
      setConfirmando(id);
    }
  }

  if (deals.length === 0) {
    return (
      <div className="saved-view">
        <h1 className="saved-title">Deals guardados</h1>
        <div className="saved-empty-box">
          <p className="saved-empty">
            Todavía no guardaste ningún deal. Evaluá uno y tocá “Guardar deal”.
          </p>
          <button type="button" className="btn-mini" onClick={onIrCalculadora}>
            Ir a la calculadora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-view">
      <div className="saved-head">
        <div>
          <h1 className="saved-title">Deals guardados</h1>
          <p className="saved-summary">
            {deals.length} {deals.length === 1 ? "deal" : "deals"} · {sirven}{" "}
            {sirven === 1 ? "sirve" : "sirven"}
          </p>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={"seg" + (orden === "recientes" ? " active" : "")}
            onClick={() => setOrden("recientes")}
          >
            Recientes
          </button>
          <button
            type="button"
            className={"seg" + (orden === "mejores" ? " active" : "")}
            onClick={() => setOrden("mejores")}
          >
            Mejores primero
          </button>
        </div>
      </div>

      <ul className="saved-list">
        {lista.map((d) => {
          const e = estado(d.trapped);
          return (
            <li className="saved-item" key={d.id}>
              <span className="estado-dot" style={{ background: e.color }} />
              <div className="saved-info">
                <span className="saved-name">{d.name || "Sin nombre"}</span>
                <span className="saved-meta">
                  {new Date(d.savedAt).toLocaleDateString("es-AR")} · compra{" "}
                  {formatMoney(d.form?.purchase_price)} · ARV{" "}
                  {formatMoney(d.form?.arv)}
                </span>
              </div>
              <div className="saved-metric">
                <span className="saved-trapped" style={{ color: e.color }}>
                  {formatMoney(d.trapped)}
                </span>
                <span className="saved-chip" style={{ color: e.color }}>
                  {e.chip}
                </span>
              </div>
              <div className="saved-actions">
                <button className="btn-mini" onClick={() => onAbrir(d)}>
                  Abrir
                </button>
                <button
                  className={
                    "btn-mini ghost" + (confirmando === d.id ? " peligro" : "")
                  }
                  onClick={() => clickEliminar(d.id)}
                >
                  {confirmando === d.id ? "¿Seguro?" : "Eliminar"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
