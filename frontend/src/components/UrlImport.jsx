// Autocompletar el deal pegando el link de un aviso.

import { useState } from "react";
import { extractDealUrl } from "../api.js";

export default function UrlImport({ onExtracted }) {
  const [url, setUrl] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function traer() {
    const limpio = url.trim();
    if (!limpio) return;
    setCargando(true);
    setError(null);
    try {
      const fields = await extractDealUrl(limpio);
      if (Object.keys(fields).length === 0) {
        setError("No pude leer datos de la propiedad en ese link.");
      } else {
        onExtracted(fields);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="url-import">
      <div className="url-row">
        <input
          className="url-input"
          type="url"
          inputMode="url"
          placeholder="Pegá el link del aviso"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          className="btn-photo"
          onClick={traer}
          disabled={cargando}
        >
          {cargando ? "Leyendo…" : "Traer del link"}
        </button>
      </div>
      {error && <span className="photo-error">{error}</span>}
    </div>
  );
}
