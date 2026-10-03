"""Punto de entrada de FastAPI."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Carga el .env a os.environ (OPENAI_API_KEY, APP_KEY, CORS_ORIGINS, etc.).
load_dotenv()

from api.limiter import limiter  # noqa: E402  (despues de load_dotenv)
from api.routers import deals, products  # noqa: E402

app = FastAPI(title="Calculadora BRRRR", version="0.1.0")

# Rate limiting por IP: el limiter y el handler que traduce el exceso a un 429
# amable. Los limites concretos se declaran por endpoint en el router.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: el frontend (Vercel) y la APK (WebView en https://localhost) viven en
# otro origen que el backend, asi que hay que permitirlos explicitamente. Se
# configuran por la variable CORS_ORIGINS (lista separada por comas). Por
# defecto permitimos solo los origenes de la app (no "*").
_origins_default = "https://localhost,capacitor://localhost,http://localhost"
_origins = os.environ.get("CORS_ORIGINS", _origins_default).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(deals.router)
app.include_router(products.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Chequeo simple de que el servicio responde."""
    return {"status": "ok"}
