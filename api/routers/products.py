"""Buscador de productos de rehab: sólo consulta, nunca compra ni cambia deals."""

from __future__ import annotations

import openai
from fastapi import APIRouter, Depends, HTTPException, Request

from api.ai import credenciales_configuradas
from api.limiter import limiter
from api.products import search_products
from api.security import requiere_app_key
from schemas.products import ProductSearchRequest, ProductSearchResult

router = APIRouter(prefix="/products", tags=["productos rehab"])


@router.post("/search", response_model=ProductSearchResult,
             dependencies=[Depends(requiere_app_key)])
@limiter.limit("5/minute")
def search(request: Request, payload: ProductSearchRequest) -> ProductSearchResult:
    if not credenciales_configuradas():
        raise HTTPException(status_code=503, detail="La búsqueda con IA no está activada. Configurá OPENAI_API_KEY en el servidor para buscar productos y precios reales.")
    try:
        return search_products(payload)
    except openai.AuthenticationError:
        raise HTTPException(status_code=503, detail="La clave de IA del servidor no es válida. Revisá la configuración.")
    except openai.RateLimitError:
        raise HTTPException(status_code=429, detail="La IA llegó a su límite de uso. Intentá más tarde o revisá el saldo del servidor.")
    except (openai.APIError, ValueError):
        raise HTTPException(status_code=502, detail="No se pudo completar la búsqueda de productos. Intentá nuevamente.")
