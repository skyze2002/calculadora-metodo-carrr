// Campo de LTV: input con sufijo "%" y chips rapidos (65 / 70 / 75 / 80).

import { cleanPercent } from "../format.js";

const CHIPS = [65, 70, 75, 80];

export default function LtvField({ value, onChange }) {
  return (
    <div className="ltv-field">
      <div className="ltv-input-wrap">
        <input
          className="field-input ltv-input"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(cleanPercent(e.target.value))}
        />
        <span className="ltv-suffix">%</span>
      </div>
      <div className="ltv-chips">
        {CHIPS.map((c) => (
          <button
            type="button"
            key={c}
            className={"ltv-chip" + (Number(value) === c ? " active" : "")}
            onClick={() => onChange(String(c))}
          >
            {c}%
          </button>
        ))}
      </div>
    </div>
  );
}
