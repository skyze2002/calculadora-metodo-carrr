"""Schemas Pydantic de entrada y salida de la API.

El dinero entra y sale como string (ver schemas/types.py). Pydantic lo convierte
a Decimal para el dominio y lo devuelve como string en el JSON.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from schemas.types import Money, Percent


class DrawIn(BaseModel):
    """Un desembolso parcial del rehab en la entrada."""

    month: int = Field(ge=0)
    amount: Money


class DealCreate(BaseModel):
    """Entrada para evaluar (y opcionalmente guardar) un deal."""

    name: str = Field(min_length=1, max_length=200)

    purchase_price: Money
    rehab_budget: Money
    arv: Money

    # Prestamista privado.
    ltc: Percent
    draws: list[DrawIn] = Field(default_factory=list)

    # Refi con el banco.
    ltv: Percent
    seasoning_months: int = Field(ge=0)
    closing_costs: Money = Field(default="0")  # type: ignore[assignment]


class DealResultOut(BaseModel):
    """Resultado del calculo devuelto al frontend."""

    model_config = ConfigDict(from_attributes=True)

    private_loan_amount: Money
    payoff: Money
    refinance_loan_amount: Money
    cash_out: Money
    total_invested: Money
    trapped_cash: Money
