// Barra superior sticky: marca, tabs segmentados y "Guardar deal".

export default function TopBar({ vista, setVista, dealsCount, progressCount, onGuardar, guardado }) {
  return (
    <header className="topbar">
      <span className="brand">
        brrrr<span className="brand-dot">.</span>
      </span>

      <nav className="segmented topbar-nav" aria-label="Menú principal">
        <button
          type="button"
          className={"seg" + (vista === "calc" ? " active" : "")}
          aria-current={vista === "calc" ? "page" : undefined}
          onClick={() => setVista("calc")}
        >
          Calculadora
        </button>
        <button
          type="button"
          className={"seg" + (vista === "guardados" ? " active" : "")}
          aria-current={vista === "guardados" ? "page" : undefined}
          onClick={() => setVista("guardados")}
        >
          Guardados
          {dealsCount > 0 && <span className="seg-count">{dealsCount}</span>}
        </button>
        <button
          type="button"
          className={"seg" + (vista === "progreso" ? " active" : "")}
          aria-current={vista === "progreso" ? "page" : undefined}
          onClick={() => setVista("progreso")}
        >
          En progreso
          {progressCount > 0 && <span className="seg-count">{progressCount}</span>}
        </button>
        <button
          type="button"
          className={"seg" + (vista === "productos" ? " active" : "")}
          aria-current={vista === "productos" ? "page" : undefined}
          onClick={() => setVista("productos")}
        >
          Productos rehab
        </button>
      </nav>

      {vista === "calc" && (
        <button type="button" className="btn-topsave" onClick={onGuardar}>
          {guardado ? "Guardado ✓" : "Guardar deal"}
        </button>
      )}
    </header>
  );
}
