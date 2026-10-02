// Campo de monto: stepper (− / +), input centrado y slider con rango inteligente.
// No hace aritmetica de plata del negocio: solo mueve el propio valor del campo
// y calcula geometria de display (anchos, posicion del marcador), como Waterfall.

import { useEffect, useRef, useState } from "react";
import { formatThousands, onlyDigits } from "../format.js";

export default function MoneyField({ value, onChange, step }) {
  const val = Number(value) || 0;
  // Anchor = valor de referencia del rango. Se actualiza en cambios que NO son
  // del drag (tipeo, autocompletar, abrir guardado, deshacer).
  const [anchor, setAnchor] = useState(val);
  const desdeSlider = useRef(false);

  useEffect(() => {
    if (desdeSlider.current) {
      desdeSlider.current = false;
      return;
    }
    setAnchor(Number(value) || 0);
  }, [value]);

  // Rango: si el anchor es 0, se usa step*100 como referencia.
  const ref = anchor > 0 ? anchor : step * 100;
  const decena = step * 10;
  let min = Math.floor((ref * 0.4) / decena) * decena;
  let max = Math.ceil((ref * 1.6) / decena) * decena;
  // Si el valor actual queda afuera, el rango se extiende.
  min = Math.min(min, val);
  max = Math.max(max, val);
  if (max <= min) max = min + decena;

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const frac = clamp01((val - min) / (max - min));
  const anchorFrac = clamp01((ref - min) / (max - min));

  const aplicar = (nuevo) => onChange(onlyDigits(String(Math.max(0, nuevo))));

  return (
    <div className="money-field">
      <div className="money-box">
        <button
          type="button"
          className="money-step"
          onClick={() => aplicar(val - step)}
          aria-label="Restar"
        >
          −
        </button>
        <input
          className="money-input"
          inputMode="decimal"
          value={"$" + formatThousands(value)}
          onChange={(e) => {
            desdeSlider.current = false;
            onChange(onlyDigits(e.target.value));
          }}
        />
        <button
          type="button"
          className="money-step"
          onClick={() => aplicar(val + step)}
          aria-label="Sumar"
        >
          +
        </button>
      </div>

      <div className="slider-wrap">
        <div className="slider-track" />
        <div
          className="slider-fill"
          style={{ width: `calc((100% - 24px) * ${frac})` }}
        />
        <div
          className="slider-anchor"
          style={{ left: `calc(12px + (100% - 24px) * ${anchorFrac})` }}
        />
        <input
          type="range"
          className="slider-range"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={(e) => {
            desdeSlider.current = true;
            onChange(onlyDigits(e.target.value));
          }}
        />
      </div>

      <div className="slider-labels">
        <span>${formatThousands(String(min))}</span>
        <span>± ${formatThousands(String(step))}</span>
        <span>${formatThousands(String(max))}</span>
      </div>
    </div>
  );
}
