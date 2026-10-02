// Tarjeta "Lectura del deal": análisis con IA, con skeleton al cargar y aviso
// cuando quedó viejo respecto al resultado actual.

export default function AiAnalysis({ analisis, analizando, error, stale, onPedir }) {
  const etiquetaBoton = !analisis ? "Explicar con IA" : stale ? "Actualizar" : "Regenerar";

  return (
    <section className="ai-card">
      <div className="ai-head">
        <span className="ai-kicker">
          Lectura del deal<span className="ai-tag">IA</span>
        </span>
        {!analizando && (
          <button type="button" className="btn-ai" onClick={onPedir}>
            {etiquetaBoton}
          </button>
        )}
      </div>

      {analizando ? (
        <div className="ai-skeleton">
          <span className="sk-line" />
          <span className="sk-line" />
          <span className="sk-line short" />
        </div>
      ) : error ? (
        <p className="ai-error">{error}</p>
      ) : analisis ? (
        <p className="ai-text">
          {stale && (
            <span className="ai-stale">
              Los números cambiaron desde esta lectura.{" "}
            </span>
          )}
          {analisis}
        </p>
      ) : (
        <p className="ai-hint">
          Generá una explicación en lenguaje natural de este deal.
        </p>
      )}
    </section>
  );
}
