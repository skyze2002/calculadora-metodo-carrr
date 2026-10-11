"""Comparables (comps) de una propiedad. TEMPORAL: solo exploración por ahora."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from api import comps
from api.limiter import limiter
from api.security import requiere_app_key

router = APIRouter(prefix="/comps", tags=["comparables"])


@router.get("/_explore", dependencies=[Depends(requiere_app_key)])
@limiter.limit("6/minute")
def explore(request: Request, address: str):
    try:
        return comps.explorar(address)
    except Exception as e:  # noqa: BLE001  (temporal, para diagnosticar)
        raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {str(e)[:220]}")
