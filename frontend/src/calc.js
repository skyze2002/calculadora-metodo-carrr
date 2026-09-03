// ESPEJO de core/calculator.py — SOLO para el demo estatico sin backend.
//
// Se usa unicamente cuando el sitio esta en produccion y NO hay VITE_API_URL
// configurada (ver api.js). En dev y cuando conectes el backend real, este
// archivo NO se usa: manda la API, que es la fuente de verdad del calculo.
//
// ROMPE la regla 4 a proposito, como atajo temporal para mostrarle la
// calculadora a un cliente sin levantar backend. Mantener en sync con core.

// Redondeo a centavos, medio hacia arriba (como ROUND_HALF_UP del backend).
function round2(n) {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function evaluateLocal(deal) {
  const num = (v) => Number(v || 0);

  const totalCost = num(deal.purchase_price) + num(deal.rehab_budget);
  const privateLoan = totalCost * num(deal.ltc);
  const downPayment = totalCost - privateLoan;
  const pointsAmount = privateLoan * num(deal.points);
  const monthlyInterest = privateLoan * num(deal.monthly_interest_rate);
  const payoff = privateLoan + pointsAmount;
  const refi = num(deal.arv) * num(deal.ltv);
  const cashOut = refi - payoff - num(deal.closing_costs);
  const totalInvested = downPayment;
  const trapped = totalInvested - cashOut;

  return {
    total_cost: round2(totalCost),
    private_loan_amount: round2(privateLoan),
    down_payment: round2(downPayment),
    points_amount: round2(pointsAmount),
    monthly_interest: round2(monthlyInterest),
    payoff: round2(payoff),
    refinance_loan_amount: round2(refi),
    cash_out: round2(cashOut),
    total_invested: round2(totalInvested),
    trapped_cash: round2(trapped),
  };
}
