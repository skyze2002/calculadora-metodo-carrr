"""Buscador de productos de rehab (Google Shopping): sólo consulta, nunca compra."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from api import products
from api.limiter import limiter
from api.security import requiere_app_key
from schemas.products import ProductSearchRequest, ProductSearchResult

router = APIRouter(prefix="/products", tags=["productos rehab"])


@router.post(
    "/search",
    response_model=ProductSearchResult,
    dependencies=[Depends(requiere_app_key)],
)
@limiter.limit("5/minute")
def search(request: Request, payload: ProductSearchRequest) -> ProductSearchResult:
    if not products.configurado():
        raise HTTPException(
            status_code=503,
            detail="La búsqueda de productos no está activada. Configurá "
            "SERPAPI_KEY en el servidor para ver productos y precios reales.",
        )
    try:
        return products.search_products(payload)
    except httpx.HTTPStatusError as e:
        codigo = e.response.status_code
        if codigo in (401, 403):
            raise HTTPException(
                status_code=503,
                detail="La clave de búsqueda del servidor no es válida. Revisá la "
                "configuración.",
            )
        if codigo == 429:
            raise HTTPException(
                status_code=429,
                detail="La búsqueda llegó a su límite de uso. Intentá más tarde o "
                "revisá el saldo del servidor.",
            )
        raise HTTPException(
            status_code=502,
            detail="No se pudo completar la búsqueda de productos. Intentá nuevamente.",
        )
    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="No se pudo completar la búsqueda de productos. Intentá nuevamente.",
        )
