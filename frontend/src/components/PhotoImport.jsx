// Boton para autocompletar el deal desde una foto de un aviso. Achica la imagen
// en el dispositivo, la manda al backend (vision) y rellena los campos.

import { useRef, useState } from "react";
import { extractDeal } from "../api.js";

// Achica la imagen a max px por lado y devuelve un data URL JPEG (mas liviano).
function achicarImagen(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala);
      const h = Math.round(img.height * escala);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}

export default function PhotoImport({ onExtracted }) {
  const inputRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function manejar(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = ""; // permite volver a elegir la misma foto
    if (!file) return;
    setCargando(true);
    setError(null);
    try {
      const dataUrl = await achicarImagen(file, 1600);
      const fields = await extractDeal(dataUrl);
      if (Object.keys(fields).length === 0) {
        setError("No pude leer datos de la propiedad en esa foto.");
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
    <div className="photo-import">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={manejar}
      />
      <button
        type="button"
        className="btn-photo"
        onClick={() => inputRef.current?.click()}
        disabled={cargando}
      >
        {cargando ? "Leyendo foto…" : "Cargar desde foto"}
      </button>
      {error && <span className="photo-error">{error}</span>}
    </div>
  );
}
