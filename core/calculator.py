"""Calculo puro de un deal BRRRR.

ESTA ES LA PIEZA CRITICA. No se modifica sin tests que la cubran (regla 3).
Un error aca cuesta dinero real.

Reglas:
- Todo el dinero es Decimal. Nunca float.
- Funcion pura: sin efectos secundarios, sin sesiones de db, sin FastAPI.

ESTADO: esqueleto. La logica todavia no esta implementada porque hay decisiones
financieras que resolver antes (interes del prestamista, composicion del payoff,
rol del seasoning y de los draws). Ver preguntas abiertas en el chat / README.
"""

from __future__ import annotations

from core.models import DealInput, DealResult


def evaluate_deal(deal: DealInput) -> DealResult:
    """Evalua un deal BRRRR y devuelve las metricas de rentabilidad.

    La metrica que importa es `trapped_cash` (dinero atrapado): total invertido
    menos cash out. Mientras mas cerca de cero, mejor.

    Args:
        deal: datos de la propiedad, del prestamista privado y del refi.

    Returns:
        DealResult con payoff, cash_out, dinero atrapado y los intermedios.
    """
    # TODO: implementar cuando cerremos las definiciones financieras.
    raise NotImplementedError(
        "El calculo todavia no esta implementado. Falta definir el interes del "
        "prestamista, la composicion del payoff y el manejo de draws/seasoning."
    )
