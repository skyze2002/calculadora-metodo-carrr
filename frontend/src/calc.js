// Calculo local de la app (standalone, sin backend).
//
// Modelo simplificado que estamos armando con el cliente:
// - El prestamista privado presta un total (loan_total).
// - Lo que se lleva el prestamista el dia de cierre = 20% del PRECIO DE COMPRA
//   + los costes de cierre que ingresa el usuario (closing_fee).
//
// El resto (refi, cash out, dinero atrapado) queda por ahora con el modelo
// anterior, alimentado por loan_total; lo vamos a reformar en el proximo paso.

// Porcentaje fijo que se lleva el prestamista sobre el precio de compra.
const LENDER_RATE = 0.2;

// Redondeo a centavos, medio hacia arriba (como el backend).
function round2(n) {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function evaluateLocal(deal) {
  const num = (v) => Number(v || 0);

  const loanTotal = num(deal.loan_total);
  const totalCost = num(deal.purchase_price) + num(deal.rehab_budget);

  // Lo que se lleva el prestamista el dia de cierre: 20% del precio de compra
  // + los costes de cierre ingresados.
  const lenderClosing = num(deal.purchase_price) * LENDER_RATE + num(deal.closing_fee);

  const privateLoan = loanTotal;
  const downPayment = Math.max(totalCost - loanTotal, 0);
  // El pago al prestamista es el total del prestamo (su ganancia va aparte
  // en lender_closing, no se suma aca).
  const payoff = loanTotal;

  const refi = num(deal.arv) * num(deal.ltv);
  const cashOut = refi - payoff;
  const totalInvested = downPayment;
  const trapped = totalInvested - cashOut;

  return {
    total_cost: round2(totalCost),
    private_loan_amount: round2(privateLoan),
    lender_closing: round2(lenderClosing),
    down_payment: round2(downPayment),
    payoff: round2(payoff),
    refinance_loan_amount: round2(refi),
    cash_out: round2(cashOut),
    total_invested: round2(totalInvested),
    trapped_cash: round2(trapped),
  };
}
