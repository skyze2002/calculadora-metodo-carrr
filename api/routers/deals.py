"""Endpoints de deals.

El router traduce entre los schemas Pydantic y los modelos puros de `core`,
llama al calculo y devuelve el resultado. NO hace aritmetica: eso vive en core.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter

from core.calculator import evaluate_deal
from core.models import (
    BankRefinance,
    DealInput,
    Draw,
    PrivateLoan,
)
from schemas.deal import DealCreate, DealResultOut

router = APIRouter(prefix="/deals", tags=["deals"])


def _to_domain(payload: DealCreate) -> DealInput:
    """Convierte el schema de entrada en el modelo puro del dominio."""
    return DealInput(
        purchase_price=payload.purchase_price,
        rehab_budget=payload.rehab_budget,
        arv=payload.arv,
        private_loan=PrivateLoan(
            ltc=payload.ltc,
            draws=tuple(
                Draw(month=d.month, amount=d.amount) for d in payload.draws
            ),
        ),
        bank_refinance=BankRefinance(
            ltv=payload.ltv,
            seasoning_months=payload.seasoning_months,
            closing_costs=payload.closing_costs or Decimal("0"),
        ),
    )


@router.post("/evaluate", response_model=DealResultOut)
def evaluate(payload: DealCreate) -> DealResultOut:
    """Evalua un deal y devuelve las metricas. No lo guarda."""
    result = evaluate_deal(_to_domain(payload))
    return DealResultOut.model_validate(result)
