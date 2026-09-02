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
    # Tasa de interes MENSUAL como fraccion sobre el prestamo total.
    # Ej: Decimal("0.005") = 0,5% mensual. Se paga mes a mes, no va al payoff.
    monthly_interest_rate: Decimal = Decimal("0")
    # Puntos / origination fee como fraccion del prestamo. Ej: Decimal("0.02").
    # Se pagan en el payoff.
    points: Decimal = Decimal("0")
    # Cronograma de desembolsos del rehab. Concepto del dominio (scope of work);
    # por ahora NO entra al calculo: el interes corre sobre el prestamo total.
    draws: tuple[Draw, ...] = field(default_factory=tuple)


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
    # Aporte inicial: parte de compra+rehab que el prestamista no financio.
    down_payment: Decimal
    # Puntos / origination fee en dinero (prestamo x points).
    points_amount: Decimal
    # Interes de un mes en dinero (prestamo x tasa mensual). Informativo:
    # se paga mes a mes y NO afecta el dinero atrapado.
    monthly_interest: Decimal
    # Lo que se le entrega al prestamista el dia del refi (principal + puntos).
    payoff: Decimal
    # Monto del nuevo prestamo del banco (LTV sobre ARV).
    refinance_loan_amount: Decimal
    # Dinero que devuelve el banco despues de pagar payoff y costos de cierre.
    cash_out: Decimal
    # Total que puso el inversor de su bolsillo (por ahora, el aporte inicial).
    total_invested: Decimal
    # Total invertido menos cash out. La metrica que decide si el deal sirve.
    trapped_cash: Decimal
