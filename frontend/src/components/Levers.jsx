// Palancas para llevar el dinero atrapado a cero. Solo si el deal es malo.
// Los montos objetivo salen del calculo (result.target_*); aca solo se muestran.

import { formatMoney } from "../format.js";

export default function Levers({ result, onProbar }) {
  if (Number(result.trapped_cash) <= 0) return null;

  const compra = Number(result.purchase_price);
  const rehab = Number(result.rehab_budget);
  const arv = Number(result.arv);
  const tr = Number(result.target_rehab);

  const filas = [
    {
      campo: "purchase_price",
      texto: `Comprar a ${formatMoney(result.target_purchase)}`,
      valor: result.target_purchase,
      diff: Number(result.target_purchase) - compra,
    },
    {
      campo: "rehab_budget",
      texto:
        tr <= 0
          ? "No alcanza solo con rehab"
          : `Bajar el rehab a ${formatMoney(result.target_rehab)}`,
      valor: result.target_rehab,
      diff: tr - rehab,
      sinBoton: tr <= 0,
    },
    {
      campo: "arv",
      texto: `Que tase en ${formatMoney(result.target_arv)}`,
      valor: result.target_arv,
      diff: Number(result.target_arv) - arv,
    },
  ];

  return (
    <section className="levers card">
      <h3 className="levers-title">Para llevarlo a cero</h3>
      <p className="levers-sub">
        Cambiando una sola variable. Tocá Probar para aplicarla.
      </p>
      <ul className="levers-list">
        {filas.map((f) => (
          <li className="lever-row" key={f.campo}>
            <span className="lever-text">{f.texto}</span>
            {!f.sinBoton && (
              <>
                <span className={"lever-diff " + (f.diff < 0 ? "baja" : "sube")}>
                  {f.diff < 0 ? "−" : "+"}
                  {formatMoney(Math.abs(f.diff).toFixed(2))}
                </span>
                <button
                  type="button"
                  className="lever-probar"
                  onClick={() => onProbar(f.campo, f.valor)}
                >
                  Probar
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
