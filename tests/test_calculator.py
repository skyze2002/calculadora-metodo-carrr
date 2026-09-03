"""Tests del calculo puro.

core/calculator.py es la pieza que decide si un deal sirve. Estos tests fijan el
comportamiento esperado con numeros reales para que no se rompa sin darnos cuenta.
"""

from __future__ import annotations

from decimal import Decimal

from core.calculator import evaluate_deal
from core.models import BankRefinance, DealInput, PrivateLoan


def _deal_base() -> DealInput:
    """El deal del ejemplo acordado con el usuario.

    compra 100.000, rehab 30.000, ARV 180.000, LTC 90%, LTV 75%,
    puntos 2%, interes 0,5% mensual, closing 4.000.
    """
    return DealInput(
        purchase_price=Decimal("100000"),
        rehab_budget=Decimal("30000"),
        arv=Decimal("180000"),
        private_loan=PrivateLoan(
            ltc=Decimal("0.90"),
            monthly_interest_rate=Decimal("0.005"),
            points=Decimal("0.02"),
        ),
        bank_refinance=BankRefinance(
            ltv=Decimal("0.75"),
            seasoning_months=6,
            closing_costs=Decimal("4000"),
        ),
    )


def test_ejemplo_acordado() -> None:
    """Verifica todos los intermedios y el dinero atrapado del ejemplo."""
    result = evaluate_deal(_deal_base())

    assert result.total_cost == Decimal("130000.00")
    assert result.private_loan_amount == Decimal("117000.00")
    assert result.down_payment == Decimal("13000.00")
    assert result.points_amount == Decimal("2340.00")
    assert result.monthly_interest == Decimal("585.00")
    assert result.payoff == Decimal("119340.00")
    assert result.refinance_loan_amount == Decimal("135000.00")
    assert result.cash_out == Decimal("11660.00")
    assert result.total_invested == Decimal("13000.00")
    assert result.trapped_cash == Decimal("1340.00")


def test_todo_devuelve_dos_decimales() -> None:
    """Todos los montos salen redondeados a centavos."""
    result = evaluate_deal(_deal_base())
    for value in vars(result).values():
        assert value.as_tuple().exponent == -2


def test_interes_no_afecta_el_dinero_atrapado() -> None:
    """El interes es informativo: cambiar la tasa no mueve trapped_cash."""
    base = _deal_base()
    otra_tasa = DealInput(
        purchase_price=base.purchase_price,
        rehab_budget=base.rehab_budget,
        arv=base.arv,
        private_loan=PrivateLoan(
            ltc=base.private_loan.ltc,
            monthly_interest_rate=Decimal("0.015"),  # el triple
            points=base.private_loan.points,
        ),
        bank_refinance=base.bank_refinance,
    )

    r1 = evaluate_deal(base)
    r2 = evaluate_deal(otra_tasa)

    assert r1.trapped_cash == r2.trapped_cash
    assert r2.monthly_interest == Decimal("1755.00")  # 117000 * 0,015


def test_deal_sin_fees() -> None:
    """Sin puntos ni interes, el payoff es solo el principal."""
    deal = DealInput(
        purchase_price=Decimal("100000"),
        rehab_budget=Decimal("30000"),
        arv=Decimal("180000"),
        private_loan=PrivateLoan(ltc=Decimal("0.90")),
        bank_refinance=BankRefinance(
            ltv=Decimal("0.75"),
            seasoning_months=6,
            closing_costs=Decimal("0"),
        ),
    )
    result = evaluate_deal(deal)

    assert result.points_amount == Decimal("0.00")
    assert result.monthly_interest == Decimal("0.00")
    assert result.payoff == Decimal("117000.00")
    # cash_out = 135000 - 117000 - 0 = 18000; atrapado = 13000 - 18000 = -5000
    assert result.cash_out == Decimal("18000.00")
    assert result.trapped_cash == Decimal("-5000.00")


def test_trapped_cash_negativo_cuando_sacas_mas_de_lo_puesto() -> None:
    """Un trapped_cash negativo significa que recuperaste mas que tu aporte."""
    result = evaluate_deal(
        DealInput(
            purchase_price=Decimal("100000"),
            rehab_budget=Decimal("30000"),
            arv=Decimal("200000"),  # ARV alto -> mucho cash out
            private_loan=PrivateLoan(ltc=Decimal("0.90"), points=Decimal("0.02")),
            bank_refinance=BankRefinance(
                ltv=Decimal("0.75"),
                seasoning_months=6,
                closing_costs=Decimal("4000"),
            ),
        )
    )
    assert result.trapped_cash < Decimal("0")
