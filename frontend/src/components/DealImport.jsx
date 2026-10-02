// Caja unica para autocompletar el deal: desde el link de un aviso o una foto.
// Muestra un estado compartido abajo.

import { useRef, useState } from "react";
import { extractDeal, extractDealUrl } from "../api.js";

const ETIQ = {
  name: "nombre",
  purchase_price: "compra",
  rehab_budget: "rehab",
  arv: "ARV",
};

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

export default function DealImport({ onExtracted }) {
  const inputRef = useRef(null);
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState(null); // { tipo, msg }

  function exito(fields) {
    const lista = Object.keys(fields)
      .filter((k) => ETIQ[k])
      .map((k) => ETIQ[k]);
    setEstado({
      tipo: "ok",
      msg: `Completé ${lista.join(", ")}. Revisá los campos marcados.`,
    });
    onExtracted(fields);
  }

  async function traerLink() {
    const limpio = url.trim();
    if (!limpio) return;
    setEstado({ tipo: "cargando", msg: "Leyendo el link…" });
    try {
      const fields = await extractDealUrl(limpio);
      if (Object.keys(fields).length === 0) {
        setEstado({ tipo: "error", msg: "No pude leer datos en ese link." });
      } else {
        exito(fields);
      }
    } catch (err) {
      setEstado({ tipo: "error", msg: err.message });
    }
  }

  async function subirFoto(evento) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    setEstado({ tipo: "cargando", msg: "Leyendo la foto…" });
    try {
      const dataUrl = await achicarImagen(file, 1600);
      const fields = await extractDeal(dataUrl);
      if (Object.keys(fields).length === 0) {
        setEstado({ tipo: "error", msg: "No pude leer datos en esa foto." });
      } else {
        exito(fields);
      }
    } catch (err) {
      setEstado({ tipo: "error", msg: err.message });
    }
  }

  return (
    <div className="import-box">
      <div className="import-row">
        <input
          className="url-input"
          type="url"
          inputMode="url"
          placeholder="Pegá el link del aviso"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="button" className="btn-traer" onClick={traerLink}>
          Traer
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={subirFoto}
        />
        <button
          type="button"
          className="btn-captura"
          onClick={() => inputRef.current?.click()}
        >
          Subir captura
        </button>
      </div>
      {estado && <p className={"import-status " + estado.tipo}>{estado.msg}</p>}
    </div>
  );
}
