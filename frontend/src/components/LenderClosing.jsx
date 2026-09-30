// Lo que se lleva el prestamista el dia de cierre: 20% del prestamo + $10.000.

import { formatMoney } from "../format.js";

export default function LenderClosing({ result, closingFee }) {
  return (
    <section className="closing">
      <span className="closing-kicker">Se lleva al cierre</span>
      <div className="closing-amount">{formatMoney(result.lender_closing)}</div>
      <p className="closing-detail">
        20% del precio de compra + {formatMoney(closingFee)} de costes de cierre
      </p>
    </section>
  );
}
