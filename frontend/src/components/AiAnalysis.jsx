// Tarjeta del analisis con IA: boton para pedirlo y el texto que devuelve.

export default function AiAnalysis({ analisis, analizando, error, onPedir }) {
  return (
    <section className="ai-card">
      <div className="ai-head">
        <span className="ai-kicker">Análisis con IA</span>
        <button
          type="button"
          className="btn-ai"
          onClick={onPedir}
          disabled={analizando}
        >
          {analizando
            ? "Analizando…"
            : analisis
              ? "Regenerar"
              : "Explicar con IA"}
        </button>
      </div>

      {error && <p className="ai-error">{error}</p>}

      {analisis && <p className="ai-text">{analisis}</p>}

      {!analisis && !error && !analizando && (
        <p className="ai-hint">
          Generá una explicación en lenguaje natural de este deal.
        </p>
      )}
    </section>
  );
}
