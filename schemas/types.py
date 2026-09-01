"""Tipos compartidos de los schemas Pydantic.

REGLA: en el JSON el dinero viaja como string, nunca como numero. Un float en
JSON pierde precision; un string preserva los centavos exactos que calculo el
Decimal. Aca definimos los tipos anotados que serializan Decimal -> str.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

# Monto de dinero: se valida como Decimal, se serializa a JSON como string.
Money = Annotated[
    Decimal,
    PlainSerializer(lambda v: format(v, "f"), return_type=str, when_used="json"),
]

# Porcentaje (ltc, ltv): tambien Decimal serializado como string.
Percent = Annotated[
    Decimal,
    PlainSerializer(lambda v: format(v, "f"), return_type=str, when_used="json"),
]
