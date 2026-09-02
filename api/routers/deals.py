"""Endpoints de deals.

El router traduce entre los schemas Pydantic, los modelos puros de `core` y el
modelo de base de datos. NO hace aritmetica: el calculo vive en core.

Persistencia: guardamos solo los inputs. El resultado se recalcula al leer con
evaluate_deal, para que la unica fuente del calculo sea core.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.calculator import evaluate_deal
from core.models import (
    BankRefinance,
    DealInput,
    Draw,
    PrivateLoan,
)
from db.models import Deal
from db.session import get_session
from schemas.deal import DealCreate, DealOut, DealResultOut

router = APIRouter(prefix="/deals", tags=["deals"])


def _payload_to_domain(payload: DealCreate) -> DealInput:
    """Convierte el schema de entrada en el modelo puro del dominio."""
    return DealInput(
        purchase_price=payload.purchase_price,
        rehab_budget=payload.rehab_budget,
        arv=payload.arv,
        private_loan=PrivateLoan(
            ltc=payload.ltc,
            monthly_interest_rate=payload.monthly_interest_rate,
            points=payload.points,
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


def _orm_to_domain(deal: Deal) -> DealInput:
    """Reconstruye el modelo del dominio desde una fila de la base."""
    return DealInput(
        purchase_price=deal.purchase_price,
        rehab_budget=deal.rehab_budget,
        arv=deal.arv,
        private_loan=PrivateLoan(
            ltc=deal.ltc,
            monthly_interest_rate=deal.monthly_interest_rate,
            points=deal.points,
        ),
        bank_refinance=BankRefinance(
            ltv=deal.ltv,
            seasoning_months=deal.seasoning_months,
            closing_costs=deal.closing_costs,
        ),
    )


def _to_out(deal: Deal) -> DealOut:
    """Arma la salida: los datos guardados mas el resultado recalculado."""
    result = evaluate_deal(_orm_to_domain(deal))
    return DealOut(
        id=deal.id,
        name=deal.name,
        purchase_price=deal.purchase_price,
        rehab_budget=deal.rehab_budget,
        arv=deal.arv,
        ltc=deal.ltc,
        monthly_interest_rate=deal.monthly_interest_rate,
        points=deal.points,
        ltv=deal.ltv,
        seasoning_months=deal.seasoning_months,
        closing_costs=deal.closing_costs,
        created_at=deal.created_at,
        result=DealResultOut.model_validate(result),
    )


@router.post("/evaluate", response_model=DealResultOut)
def evaluate(payload: DealCreate) -> DealResultOut:
    """Evalua un deal y devuelve las metricas. No lo guarda."""
    result = evaluate_deal(_payload_to_domain(payload))
    return DealResultOut.model_validate(result)


@router.post("", response_model=DealOut, status_code=status.HTTP_201_CREATED)
def create_deal(
    payload: DealCreate, session: Session = Depends(get_session)
) -> DealOut:
    """Guarda un deal y devuelve sus datos mas el resultado. Ignora los draws."""
    deal = Deal(
        name=payload.name,
        purchase_price=payload.purchase_price,
        rehab_budget=payload.rehab_budget,
        arv=payload.arv,
        ltc=payload.ltc,
        monthly_interest_rate=payload.monthly_interest_rate,
        points=payload.points,
        ltv=payload.ltv,
        seasoning_months=payload.seasoning_months,
        closing_costs=payload.closing_costs or Decimal("0"),
    )
    session.add(deal)
    session.commit()
    session.refresh(deal)
    return _to_out(deal)


@router.get("", response_model=list[DealOut])
def list_deals(session: Session = Depends(get_session)) -> list[DealOut]:
    """Lista los deals guardados, del mas nuevo al mas viejo."""
    deals = session.scalars(select(Deal).order_by(Deal.id.desc())).all()
    return [_to_out(deal) for deal in deals]


@router.get("/{deal_id}", response_model=DealOut)
def get_deal(deal_id: int, session: Session = Depends(get_session)) -> DealOut:
    """Trae un deal por id. 404 si no existe."""
    deal = session.get(Deal, deal_id)
    if deal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Deal no encontrado"
        )
    return _to_out(deal)
