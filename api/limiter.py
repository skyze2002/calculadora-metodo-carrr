"""Limitador de pedidos por IP (rate limiting) compartido por la app y el router.

Vive en su propio modulo para que `api.main` y `api.routers.deals` lo importen
sin ciclo.

La clave es la IP real del cliente. Detras de un proxy viene en
X-Forwarded-For, pero ese encabezado lo puede escribir el cliente: cada proxy
AGREGA una IP al final, asi que solo son confiables las ultimas N entradas que
pusieron nuestros propios proxies. Tomar la primera permitia inventar una IP
distinta en cada pedido y saltarse el limite (gastando creditos de las APIs).

TRUSTED_PROXY_HOPS = cantidad de proxies propios delante de la app:
  1 -> solo Caddy (o el proxy de Render)      -> se usa la ultima entrada
  2 -> Cloudflare (proxy naranja) + Caddy     -> la anteultima
  0 -> sin proxy: se ignora el encabezado y se usa la conexion directa
"""

from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _hops() -> int:
    try:
        return max(0, int(os.environ.get("TRUSTED_PROXY_HOPS", "1")))
    except ValueError:
        return 1


def _client_key(request: Request) -> str:
    hops = _hops()
    reenviada = request.headers.get("x-forwarded-for")
    if hops and reenviada:
        ips = [ip.strip() for ip in reenviada.split(",") if ip.strip()]
        if len(ips) >= hops:
            return ips[-hops]
    return get_remote_address(request)


limiter = Limiter(key_func=_client_key)
