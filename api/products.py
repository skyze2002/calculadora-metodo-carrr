"""Buscador de básicos para rehab vía Google Shopping (SerpAPI).

Devuelve productos reales con foto, precio y tienda. No compra ni toca deals.
Prioriza las tiendas grandes (Amazon, Walmart, Home Depot, Lowe's). El dinero se
valida y ordena con Decimal.
"""

from __future__ import annotations

import ipaddress
import os
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import quote, urlsplit, urlunsplit

import httpx

from schemas.products import (
    CATEGORIES,
    CATEGORY_QUERY_EN,
    MARKETS,
    ProductItem,
    ProductSearchRequest,
    ProductSearchResult,
)

SERPAPI_URL = "https://serpapi.com/search"
MAX_PRODUCTS = 8

# Tiendas que el usuario quiere ver primero (match por substring en minúsculas).
TIENDAS_PREFERIDAS = ("amazon", "walmart", "home depot", "lowe's", "lowes")


def configurado() -> bool:
    """True si hay API key de SerpAPI en el entorno."""
    return bool(os.environ.get("SERPAPI_KEY"))


def public_url(value: str) -> str | None:
    """Sólo enlaces web públicos sin credenciales; no descarga ninguna URL.

    Codifica los espacios del path/query (Google Shopping los deja sin escapar
    en product_link), pero rechaza caracteres de control y espacios en el host.
    """
    try:
        if not isinstance(value, str):
            return None
        value = value.strip()
        # Caracteres de control (CR/LF/TAB, etc.): peligrosos en un enlace.
        if any(ord(ch) < 0x20 or ord(ch) == 0x7F for ch in value):
            return None
        parsed = urlsplit(value)
        host = parsed.hostname
        if (
            parsed.scheme not in ("http", "https")
            or not host
            or parsed.username
            or parsed.password
            or parsed.port not in (None, 80, 443)
            or " " in parsed.netloc
        ):
            return None
        if host.lower() == "localhost" or host.lower().endswith(
            (".localhost", ".local", ".internal")
        ):
            return None
        if ":" in host or re.fullmatch(r"[\d.]+", host):
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            if "." not in host:
                return None
        seguro = "/%:@&=+$,;~!*'()[]"
        path = quote(parsed.path, safe=seguro)
        query = quote(parsed.query, safe=seguro + "?")
        return urlunsplit((parsed.scheme, parsed.netloc, path, query, ""))
    except (ValueError, TypeError):
        return None


def _es_preferida(store: str) -> bool:
    bajo = store.lower()
    return any(t in bajo for t in TIENDAS_PREFERIDAS)


def _precio(valor, budget: Decimal | None) -> str | None:
    """Pasa el precio numérico de SerpAPI a 'xx.xx'. None si falta o es inválido.

    Devuelve la cadena '__CARO__' si supera el presupuesto, para descartar.
    """
    if not isinstance(valor, (int, float)) or isinstance(valor, bool):
        return None
    try:
        d = Decimal(str(valor)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None
    if d <= 0 or d >= Decimal("1000000000"):
        return None
    if budget is not None and d > budget:
        return "__CARO__"
    return format(d, ".2f")


def _consulta(payload: ProductSearchRequest) -> str:
    """Arma la query: el detalle del usuario, o el término de la categoría."""
    if payload.details.strip():
        return payload.details.strip()
    if payload.country == "US":
        return CATEGORY_QUERY_EN[payload.category]
    return CATEGORIES[payload.category]


def _item(resultado: dict, currency: str, budget: Decimal | None) -> ProductItem | None:
    """Convierte un shopping_result de SerpAPI en ProductItem, o None si no sirve."""
    url = public_url(resultado.get("product_link") or resultado.get("link") or "")
    if not url:
        return None
    title = str(resultado.get("title") or "").strip()
    store = str(resultado.get("source") or "").strip()
    if not title or not store:
        return None

    precio = _precio(resultado.get("extracted_price"), budget)
    if precio == "__CARO__":
        return None
    if budget is not None and precio is None:
        return None  # con presupuesto, un precio desconocido no cumple

    imagen = public_url(resultado.get("thumbnail") or "")
    calif = resultado.get("rating")
    rating = float(calif) if isinstance(calif, (int, float)) and 0 <= calif <= 5 else None

    return ProductItem(
        title=title[:200],
        store=store[:100],
        url=url,
        image=imagen,
        price=precio,
        currency=currency,
        rating=rating,
        delivery=str(resultado.get("delivery") or "").strip()[:160],
    )


def search_products(payload: ProductSearchRequest) -> ProductSearchResult:
    """Busca en Google Shopping (SerpAPI) y arma el resultado.

    Prioriza las tiendas preferidas; si no hay ninguna, cae en el resto para no
    quedar vacío. Lanza httpx.HTTPError si SerpAPI falla, ValueError si no está
    configurado o la respuesta es inválida.
    """
    clave = os.environ.get("SERPAPI_KEY")
    if not clave:
        raise ValueError("SerpAPI no configurado.")

    country, currency = MARKETS[payload.country]
    query = _consulta(payload)
    budget = Decimal(payload.budget) if payload.budget is not None else None

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": clave,
        "gl": payload.country.lower(),
        "hl": "en" if payload.country == "US" else "es",
        "num": "40",
    }
    with httpx.Client(timeout=40.0) as cliente:
        resp = cliente.get(SERPAPI_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    if not isinstance(data, dict):
        raise ValueError("Respuesta de SerpAPI inválida.")
    crudos = data.get("shopping_results") or []

    preferidas: list[ProductItem] = []
    otras: list[ProductItem] = []
    vistas: set[str] = set()
    for resultado in crudos:
        if not isinstance(resultado, dict):
            continue
        item = _item(resultado, currency, budget)
        if item is None or item.url in vistas:
            continue
        vistas.add(item.url)
        (preferidas if _es_preferida(item.store) else otras).append(item)

    productos = (preferidas or otras)[:MAX_PRODUCTS]

    return ProductSearchResult(
        products=productos,
        searched_at=datetime.now(timezone.utc).isoformat(),
        country=payload.country,
        currency=currency,
        query=query,
        message=(
            "Precios y stock pueden cambiar. Revisá medidas y total en la tienda."
            if productos
            else "No se encontraron productos con esos filtros. Probá ampliar el "
            "presupuesto o cambiar el detalle."
        ),
    )
