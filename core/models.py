"""Modelos de datos puros del dominio.

Son dataclasses inmutables, sin dependencias de la base de datos ni de FastAPI.
Representan la entrada y la salida del calculo. `core/` debe poder probarse solo,
asi que aca no se importa nada de `db/` ni de `api/`.

Todo el dinero es Decimal. Nunca float.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class Draw:
    """Un desembolso parcial del rehab.

    Los intereses del prestamista privado corren solo sobre el saldo desembolsado,
    por eso cada draw lleva el mes en que se libera.
    """

    # Mes (relativo al inicio del prestamo) en que se libera el desembolso.
    month: int
    amount: Decimal


@dataclass(frozen=True)
class PrivateLoan:
    """Terminos del prestamista privado que financia la compra y el rehab."""

    # Porcentaje sobre el costo total (compra + rehab). Ej: Decimal("0.90").
    ltc: Decimal
    # Cronograma de desembolsos del rehab.
    draws: tuple[Draw, ...] = field(default_factory=tuple)
    # NOTA: tasa de interes, puntos/origination y modo de calculo (simple vs
    # compuesto, mensual vs anual) se agregan cuando definamos el calculo.


@dataclass(frozen=True)
class BankRefinance:
    """Terminos del refinanciamiento con el banco."""

    # Porcentaje que el banco presta sobre el ARV. Ej: Decimal("0.75").
    ltv: Decimal
    # Meses de espera antes de poder refinanciar.
    seasoning_months: int
    # Costos de cierre del refi.
    closing_costs: Decimal = Decimal("0")


@dataclass(frozen=True)
class DealInput:
    """Todo lo que necesita el calculo para evaluar un deal."""

    purchase_price: Decimal
    rehab_budget: Decimal
    arv: Decimal
    private_loan: PrivateLoan
    bank_refinance: BankRefinance


@dataclass(frozen=True)
class DealResult:
    """Resultado del calculo. Lo que la API devuelve y el frontend muestra."""

    # Monto que presta el prestamista privado (LTC sobre costo total).
    private_loan_amount: Decimal
    # Lo que se le entrega al prestamista privado el dia del refi.
    payoff: Decimal
    # Monto del nuevo prestamo del banco (LTV sobre ARV).
    refinance_loan_amount: Decimal
    # Dinero que devuelve el banco despues de pagar payoff y costos de cierre.
    cash_out: Decimal
    # Total que puso el inversor de su bolsillo.
    total_invested: Decimal
    # Total invertido menos cash out. La metrica que decide si el deal sirve.
    trapped_cash: Decimal
