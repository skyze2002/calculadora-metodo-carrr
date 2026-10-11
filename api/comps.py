"""Comparables (comps) de una propiedad vía Zillapi.

Resuelve la dirección del deal a la propiedad real (by-address), arma filtros
tipo Zillow desde sus atributos (mismos dorm/baños, m² ±, tipo, radio) y busca
propiedades vendidas y/o en venta parecidas (search). Si no hay con las
condiciones exactas, afloja los filtros y marca el resultado como "parecidas".
Sugiere un ARV con la mediana de precio/m² de los comps vendidos.
"""

from __future__ import annotations

import math
import os

import httpx

from api.products import public_url
from schemas.comps import (
    HOME_TYPES,
    CompItem,
    CompsRequest,
    CompsResult,
    Subject,
)

ZILLAPI_BASE = "https://api.zillapi.com/v1"
MAX_COMPS = 12

# homeType de Zillow -> enum del filtro de search.
HOME_TYPE_MAP = {
    "SINGLE_FAMILY": "house",
    "CONDO": "condo",
    "TOWNHOUSE": "townhouse",
    "MULTI_FAMILY": "multi_family",
    "MANUFACTURED": "manufactured",
    "APARTMENT": "apartment",
    "LOT": "lot",
    "LAND": "lot",
}


def configurado() -> bool:
    return bool(os.environ.get("ZILLAPI_KEY"))


def _headers() -> dict[str, str]:
    clave = os.environ.get("ZILLAPI_KEY")
    if not clave:
        raise ValueError("Zillapi no configurado.")
    return {"Authorization": f"Bearer {clave}"}


# --- helpers de parseo ---

def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _int(v) -> int | None:
    n = _num(v)
    return int(n) if n is not None and n > 0 else None


def _money_str(v) -> str | None:
    n = _num(v)
    if n is not None and n > 0:
        return str(int(n))
    if isinstance(v, str) and v.strip().isdigit():
        return v.strip()
    return None


def _amount(v):
    """Monto desde un objeto {amount,...} o un número suelto."""
    if isinstance(v, dict):
        return _num(v.get("amount"))
    return _num(v)


def _img(v) -> str | None:
    if isinstance(v, str):
        return v.strip() or None
    if isinstance(v, dict):
        for k in ("url", "src", "mainImageUrl", "imageUrl", "href"):
            s = v.get(k)
            if isinstance(s, str) and s.strip():
                return s.strip()
    return None


def _addr(v) -> str:
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dict):
        if v.get("full"):
            return str(v["full"]).strip()
        if v.get("formattedAddress"):
            return str(v["formattedAddress"]).strip()
        partes = [
            v.get("street") or v.get("streetAddress"),
            v.get("city"),
            v.get("state"),
        ]
        return ", ".join(str(p).strip() for p in partes if p)
    return ""


def _haversine(lat1, lng1, lat2, lng2) -> float:
    r = 3958.8  # millas
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _bbox(lat: float, lng: float, radio_mi: float) -> dict[str, float]:
    dlat = radio_mi / 69.0
    dlng = radio_mi / (69.0 * max(0.1, math.cos(math.radians(lat))))
    return {"west": lng - dlng, "south": lat - dlat, "east": lng + dlng, "north": lat + dlat}


# --- armado del sujeto y los comps ---

def _subject(raw: dict) -> Subject:
    return Subject(
        address=_addr(raw.get("formattedAddress") or raw.get("address") or raw),
        url=public_url(raw.get("propertyUrl") or raw.get("hdpUrl") or "") or "",
        image=public_url(_img(raw.get("mainImage")) or ""),
        beds=_num(raw.get("bedrooms")),
        baths=_num(raw.get("bathrooms")),
        sqft=_int(raw.get("livingArea")),
        home_type=raw.get("homeType"),
        zestimate=_money_str(raw.get("zestimate")),
        price=_money_str(
            raw.get("price") or raw.get("lastSoldPrice") or _amount(raw.get("listingPrice"))
        ),
        lat=_num(raw.get("latitude")),
        lng=_num(raw.get("longitude")),
    )


def _comp_item(it: dict, subj: Subject) -> CompItem | None:
    zpid = str(it.get("zpid") or "").strip()
    url = public_url(it.get("propertyUrl") or it.get("hdpUrl") or "")
    if not zpid or not url:
        return None
    estado = str(it.get("listingStatus") or "").lower()
    status = "sold" if "sold" in estado else ("for_sale" if "sale" in estado else "other")
    if status == "sold":
        amount = _amount(it.get("listingSoldPrice")) or _amount(it.get("listingPrice"))
    else:
        amount = _amount(it.get("listingPrice")) or _amount(it.get("listingSoldPrice"))
    sqft = _int(it.get("livingArea"))
    pps = str(round(amount / sqft)) if amount and sqft else None

    dist = None
    coords = it.get("coordinates") or {}
    if subj.lat and subj.lng and _num(coords.get("latitude")) and _num(coords.get("longitude")):
        dist = round(_haversine(subj.lat, subj.lng, coords["latitude"], coords["longitude"]), 1)

    return CompItem(
        zpid=zpid,
        address=_addr(it.get("listingAddress")) or _addr(it.get("streetAddress")),
        url=url,
        image=public_url(_img(it.get("mainImage")) or ""),
        price=str(int(amount)) if amount else None,
        status=status,
        beds=_num(it.get("bedrooms")),
        baths=_num(it.get("bathrooms")),
        sqft=sqft,
        price_per_sqft=pps,
        date_sold=str(it.get("dateSold") or ""),
        distance_mi=dist,
    )


# --- filtros y búsqueda ---

def _filtros(subj: Subject, req: CompsRequest, relaxed: bool) -> dict:
    f: dict = {"bbox": _bbox(subj.lat, subj.lng, req.radius_mi * (2 if relaxed else 1))}

    if req.beds_min is not None or req.beds_max is not None:
        rng = {}
        if req.beds_min is not None:
            rng["min"] = req.beds_min
        if req.beds_max is not None:
            rng["max"] = req.beds_max
        f["beds"] = rng
    elif subj.beds:
        b = int(subj.beds)
        margen = 1 if relaxed else 0
        f["beds"] = {"min": max(0, b - margen), "max": b + margen}

    if req.baths_min is not None:
        f["baths"] = {"min": req.baths_min}
    elif subj.baths:
        f["baths"] = {"min": max(1, subj.baths - (1 if relaxed else 0))}

    if req.sqft_min is not None or req.sqft_max is not None:
        rng = {}
        if req.sqft_min is not None:
            rng["min"] = req.sqft_min
        if req.sqft_max is not None:
            rng["max"] = req.sqft_max
        f["sqft"] = rng
    elif subj.sqft:
        lo, hi = (0.6, 1.4) if relaxed else (0.75, 1.25)
        f["sqft"] = {"min": int(subj.sqft * lo), "max": int(subj.sqft * hi)}

    if req.home_types:
        ht = [t for t in req.home_types if t in HOME_TYPES]
        if ht:
            f["homeTypes"] = ht
    elif not relaxed:
        mapped = HOME_TYPE_MAP.get(str(subj.home_type or "").upper())
        if mapped:
            f["homeTypes"] = [mapped]

    return f


def _search(cliente: httpx.Client, filtros: dict) -> list[dict]:
    r = cliente.post(f"{ZILLAPI_BASE}/search", json={"filters": filtros, "maxItems": 20})
    r.raise_for_status()
    data = r.json() or {}
    lst = data.get("data")
    return [x for x in lst if isinstance(x, dict)] if isinstance(lst, list) else []


def _buscar_status(cliente, subj, req, status) -> tuple[list[dict], bool]:
    filtros = _filtros(subj, req, relaxed=False)
    filtros["status"] = status
    items = _search(cliente, filtros)
    if items:
        return items, False
    # Fallback: aflojar y reintentar una vez.
    filtros = _filtros(subj, req, relaxed=True)
    filtros["status"] = status
    return _search(cliente, filtros), True


def _arv(comps: list[CompItem], sqft: int | None) -> str | None:
    if not sqft:
        return None
    pps = sorted(int(c.price_per_sqft) for c in comps if c.status == "sold" and c.price_per_sqft)
    if len(pps) < 2:
        return None
    m = len(pps) // 2
    mediana = pps[m] if len(pps) % 2 else (pps[m - 1] + pps[m]) // 2
    return str(int(mediana * sqft))


def buscar_comparables(req: CompsRequest) -> CompsResult:
    """Busca comparables del inmueble. Lanza httpx.HTTPError o ValueError."""
    with httpx.Client(timeout=45.0, headers=_headers()) as cliente:
        a = cliente.get(f"{ZILLAPI_BASE}/properties/by-address", params={"address": req.address})
        a.raise_for_status()
        raw = (a.json() or {}).get("data") or {}
        subj = _subject(raw)
        subj_zpid = str(raw.get("zpid") or "")
        if not (subj.lat and subj.lng and subj_zpid):
            raise ValueError("No se encontró la propiedad o le faltan datos para comparar.")

        statuses = ["sold", "for_sale"] if req.status == "both" else [req.status]
        relaxed_any = False
        crudos: list[dict] = []
        for st in statuses:
            items, relaxed = _buscar_status(cliente, subj, req, st)
            relaxed_any = relaxed_any or relaxed
            crudos.extend(items)

    comps: list[CompItem] = []
    vistos: set[str] = set()
    for it in crudos:
        c = _comp_item(it, subj)
        if c is None or c.zpid in vistos or c.zpid == subj_zpid:
            continue
        vistos.add(c.zpid)
        comps.append(c)
    comps.sort(key=lambda c: c.distance_mi if c.distance_mi is not None else 1e9)
    comps = comps[:MAX_COMPS]

    arv = _arv(comps, subj.sqft)
    counts = {
        "sold": sum(1 for c in comps if c.status == "sold"),
        "for_sale": sum(1 for c in comps if c.status == "for_sale"),
    }
    if not comps:
        mensaje = "No se encontraron comparables cerca. Probá ampliar el radio o los filtros."
    elif relaxed_any:
        mensaje = "No había suficientes con las condiciones exactas: mostramos propiedades parecidas."
    else:
        mensaje = "Comparables con condiciones similares a la propiedad."

    return CompsResult(
        subject=subj,
        comps=comps,
        relaxed=relaxed_any,
        arv_suggestion=arv,
        message=mensaje,
        counts=counts,
    )
