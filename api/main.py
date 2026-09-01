"""Punto de entrada de FastAPI."""

from __future__ import annotations

from fastapi import FastAPI

from api.routers import deals

app = FastAPI(title="Calculadora BRRRR", version="0.1.0")

app.include_router(deals.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Chequeo simple de que el servicio responde."""
    return {"status": "ok"}
