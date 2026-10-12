"""Comparables (comps) de una propiedad vía Zillapi."""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from api import comps
from api.limiter import limiter
from api.security import requiere_app_key
from schemas.comps import CompsRequest, CompsResult

router = APIRouter(prefix="/comps", tags=["comparables"])
log = logging.getLogger(__name__)

MSG_SIN_CREDITOS = (
    "Zillapi se quedó sin créditos o la cuenta no está activa. Revisá el plan en "
    "zillapi.com."
)


@router.post(
    "/search",
    response_model=CompsResult,
    dependencies=[Depends(requiere_app_key)],
)
@limiter.limit("6/minute")
def search(request: Request, payload: CompsRequest) -> CompsResult:
    if not comps.configurado():
        raise HTTPException(
            status_code=503,
            detail="Los comparables no están activados. Configurá ZILLAPI_KEY en el servidor.",
        )
    try:
        return comps.buscar_comparables(payload)
    except httpx.HTTPStatusError as e:
        codigo = e.response.status_code
        # Sólo el código de Zillapi: nunca la key ni la respuesta completa.
        log.warning("Zillapi respondió HTTP %s en /comps/search", codigo)
        if codigo == 402:
            raise HTTPException(status_code=503, detail=MSG_SIN_CREDITOS)
        if codigo in (401, 403):
            raise HTTPException(status_code=503, detail="La clave de Zillapi no es válida.")
        if codigo == 429:
            raise HTTPException(
                status_code=429,
                detail="Zillapi llegó a su límite de uso. Intentá más tarde.",
            )
        if codigo == 404:
            raise HTTPException(
                status_code=404,
                detail="No se encontró esa dirección en Zillow. Revisá que sea una dirección válida.",
            )
        raise HTTPException(status_code=502, detail="No se pudieron traer los comparables. Intentá de nuevo.")
    except httpx.HTTPError as e:
        log.warning("Fallo de red con Zillapi en /comps/search: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="No se pudieron traer los comparables. Intentá de nuevo.")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
