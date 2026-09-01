"""Modelos SQLAlchemy.

REGLA: todo el dinero es NUMERIC, nunca FLOAT. Usamos Numeric con precision y
escala fijas para no perder centavos.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

# Precision estandar para montos: hasta 12 enteros + 2 decimales.
Money = Numeric(14, 2)
# Precision para porcentajes (ltc, ltv): ej 0.7500.
Percent = Numeric(6, 4)


class Deal(Base):
    """Un deal guardado: entrada del usuario y, opcionalmente, resultado."""

    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))

    # Entrada de la propiedad.
    purchase_price: Mapped[Decimal] = mapped_column(Money)
    rehab_budget: Mapped[Decimal] = mapped_column(Money)
    arv: Mapped[Decimal] = mapped_column(Money)

    # Prestamista privado.
    ltc: Mapped[Decimal] = mapped_column(Percent)

    # Refi con el banco.
    ltv: Mapped[Decimal] = mapped_column(Percent)
    seasoning_months: Mapped[int] = mapped_column(Integer)
    closing_costs: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # NOTA: los draws (desembolsos parciales) iran en una tabla aparte cuando
    # definamos el calculo. Ver core/models.py Draw.
