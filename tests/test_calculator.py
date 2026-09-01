"""Tests del calculo puro.

Todavia no hay logica en core/calculator.py, asi que por ahora solo verificamos
el contrato: que existe la funcion y que anuncia que falta implementarla. Cuando
definamos las formulas, estos tests se reemplazan por casos con numeros reales.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from core.calculator import evaluate_deal
from core.models import BankRefinance, DealInput, PrivateLoan


def _deal_base() -> DealInput:
    """Un deal minimo de ejemplo para los tests."""
    return DealInput(
        purchase_price=Decimal("100000"),
        rehab_budget=Decimal("30000"),
        arv=Decimal("180000"),
        private_loan=PrivateLoan(ltc=Decimal("0.90")),
        bank_refinance=BankRefinance(
            ltv=Decimal("0.75"),
            seasoning_months=6,
            closing_costs=Decimal("4000"),
        ),
    )


def test_evaluate_deal_todavia_no_implementado() -> None:
    """Mientras no cerremos las formulas, el calculo lanza NotImplementedError."""
    with pytest.raises(NotImplementedError):
        evaluate_deal(_deal_base())
