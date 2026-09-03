"""Punto de entrada de FastAPI."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import deals

app = FastAPI(title="Calculadora BRRRR", version="0.1.0")

# CORS: el frontend (Vercel) vive en otro dominio que el backend, asi que hay
# que permitir explicitamente los origenes. Se configuran por variable de
# entorno CORS_ORIGINS (lista separada por comas); por defecto, cualquiera.
_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(deals.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Chequeo simple de que el servicio responde."""
    return {"status": "ok"}
