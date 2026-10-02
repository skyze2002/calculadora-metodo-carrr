// Barra superior sticky: marca, tabs segmentados y "Guardar deal".

export default function TopBar({ vista, setVista, dealsCount, onGuardar, guardado }) {
  return (
    <header className="topbar">
      <span className="brand">
        brrrr<span className="brand-dot">.</span>
      </span>

      <div className="segmented">
        <button
          type="button"
          className={"seg" + (vista === "calc" ? " active" : "")}
          onClick={() => setVista("calc")}
        >
          Calculadora
        </button>
        <button
          type="button"
          className={"seg" + (vista === "guardados" ? " active" : "")}
          onClick={() => setVista("guardados")}
        >
          Guardados
          {dealsCount > 0 && <span className="seg-count">{dealsCount}</span>}
        </button>
      </div>

      {vista === "calc" && (
        <button type="button" className="btn-topsave" onClick={onGuardar}>
          {guardado ? "Guardado ✓" : "Guardar deal"}
        </button>
      )}
    </header>
  );
}
