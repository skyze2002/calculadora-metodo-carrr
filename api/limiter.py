"""Limitador de pedidos por IP (rate limiting) compartido por la app y el router.

Vive en su propio modulo para que `api.main` y `api.routers.deals` lo importen
sin ciclo. La clave es la IP real del cliente: detras del proxy de Render, la IP
viene en X-Forwarded-For, asi que la leemos de ahi antes de caer en la de la
conexion directa.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _client_key(request: Request) -> str:
    reenviada = request.headers.get("x-forwarded-for")
    if reenviada:
        # El primer valor es el cliente original; el resto son proxies.
        return reenviada.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_key)
