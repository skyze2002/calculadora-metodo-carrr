"""Calculo puro de un deal BRRRR.

ESTA ES LA PIEZA CRITICA. No se modifica sin tests que la cubran (regla 3).
Un error aca cuesta dinero real.

Reglas:
- Todo el dinero es Decimal. Nunca float.
- Funcion pura: sin efectos secundarios, sin sesiones de db, sin FastAPI.

Modelo de calculo (definido con el usuario):
- private_loan_amount = (compra + rehab) * LTC
- down_payment        = (compra + rehab) * (1 - LTC)   -> aporte inicial
- points_amount       = private_loan_amount * points
- monthly_interest    = private_loan_amount * tasa mensual  (informativo)
- payoff              = private_loan_amount + points_amount  (el interes se paga
                        mes a mes, no va al payoff)
- refinance_loan_amount = ARV * LTV
- cash_out            = refinance_loan_amount - payoff - closing_costs
- total_invested      = down_payment
- trapped_cash        = total_invested - cash_out   -> mientras mas cerca de 0, mejor
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from core.models import DealInput, DealResult

# Un centavo. Redondeamos los montos de dinero a dos decimales.
_CENT = Decimal("0.01")


def _cents(amount: Decimal) -> Decimal:
    """Redondea un monto a centavos (dos decimales, medio hacia arriba)."""
    return amount.quantize(_CENT, rounding=ROUND_HALF_UP)


def evaluate_deal(deal: DealInput) -> DealResult:
    """Evalua un deal BRRRR y devuelve las metricas de rentabilidad.

    La metrica que importa es `trapped_cash` (dinero atrapado): total invertido
    menos cash out. Mientras mas cerca de cero, mejor.

    Args:
        deal: datos de la propiedad, del prestamista privado y del refi.

    Returns:
        DealResult con payoff, cash_out, dinero atrapado y los intermedios.
    """
    loan = deal.private_loan
    refi = deal.bank_refinance

    # Costo total del proyecto: lo que sale comprar mas repararla.
    total_cost = deal.purchase_price + deal.rehab_budget

    # Prestamo del prestamista privado y el aporte que pone el inversor.
    private_loan_amount = total_cost * loan.ltc
    down_payment = total_cost - private_loan_amount

    # Fees del prestamista.
    points_amount = private_loan_amount * loan.points
    monthly_interest = private_loan_amount * loan.monthly_interest_rate

    # El interes se paga mes a mes; al refi solo se le entrega principal + puntos.
    payoff = private_loan_amount + points_amount

    # Refi con el banco y dinero que devuelve tras pagar el payoff y el cierre.
    refinance_loan_amount = deal.arv * refi.ltv
    cash_out = refinance_loan_amount - payoff - refi.closing_costs

    # Dinero atrapado: lo que el inversor puso y no recupero con el cash out.
    total_invested = down_payment
    trapped_cash = total_invested - cash_out

    return DealResult(
        total_cost=_cents(total_cost),
        private_loan_amount=_cents(private_loan_amount),
        down_payment=_cents(down_payment),
        points_amount=_cents(points_amount),
        monthly_interest=_cents(monthly_interest),
        payoff=_cents(payoff),
        refinance_loan_amount=_cents(refinance_loan_amount),
        cash_out=_cents(cash_out),
        total_invested=_cents(total_invested),
        trapped_cash=_cents(trapped_cash),
    )
