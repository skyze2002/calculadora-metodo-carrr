// Lo que se lleva el prestamista el dia de cierre. Version compacta: una fila.

import { formatMoney } from "../format.js";

export default function LenderClosing({ result, closingFee }) {
  return (
    <section className="closing">
      <div className="closing-info">
        <span className="closing-kicker">Se lleva al cierre</span>
        <p className="closing-detail">
          20% del precio de compra + {formatMoney(closingFee)} de costes de cierre
        </p>
      </div>
      <span className="closing-amount">{formatMoney(result.lender_closing)}</span>
    </section>
  );
}
