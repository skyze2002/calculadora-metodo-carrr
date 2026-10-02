// Apartado de deals guardados: lista solo los deals que el usuario guardo.

import { formatMoney } from "../format.js";

export default function SavedDeals({ deals, onAbrir, onEliminar }) {
  return (
    <div className="saved-view">
      <h1 className="saved-title">Deals guardados</h1>

      {deals.length === 0 ? (
        <p className="saved-empty">
          Todavía no guardaste ningún deal. Evaluá uno en la calculadora y tocá
          “Guardar deal”.
        </p>
      ) : (
        <ul className="saved-list">
          {deals.map((d) => {
            const bueno = Number(d.trapped) <= 0;
            return (
              <li className="saved-item" key={d.id}>
                <div className="saved-info">
                  <span className="saved-name">{d.name || "Sin nombre"}</span>
                  <span className="saved-date">
                    {new Date(d.savedAt).toLocaleDateString("es-AR")}
                  </span>
                </div>
                <span className={"saved-trapped " + (bueno ? "bueno" : "malo")}>
                  {formatMoney(d.trapped)}
                </span>
                <div className="saved-actions">
                  <button className="btn-mini" onClick={() => onAbrir(d)}>
                    Abrir
                  </button>
                  <button
                    className="btn-mini ghost"
                    onClick={() => onEliminar(d.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
