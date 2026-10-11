"""Comparables (comps) de una propiedad vía Zillapi.

Resuelve la dirección del deal a la propiedad real (by-address), arma filtros
tipo Zillow desde sus atributos y busca propiedades parecidas (search). Si no
hay con las condiciones exactas, afloja y marca el resultado como "parecidas".

NOTA: el formato de respuesta de /search y /nearby no está documentado en el
OpenAPI de Zillapi; esta primera versión incluye una función de exploración para
descubrir los campos reales antes de fijar el parser.
"""

from __future__ import annotations

import math
import os

import httpx

ZILLAPI_BASE = "https://api.zillapi.com/v1"


def _headers() -> dict[str, str]:
    clave = os.environ.get("ZILLAPI_KEY")
    if not clave:
        raise ValueError("Zillapi no configurado.")
    return {"Authorization": f"Bearer {clave}"}


def _bbox(lat: float, lng: float, radio_mi: float) -> dict[str, float]:
    """Caja alrededor de (lat,lng) con un radio aproximado en millas."""
    dlat = radio_mi / 69.0
    dlng = radio_mi / (69.0 * max(0.1, math.cos(math.radians(lat))))
    return {
        "west": lng - dlng,
        "south": lat - dlat,
        "east": lng + dlng,
        "north": lat + dlat,
    }


def explorar(address: str) -> dict:
    """Devuelve las formas crudas de by-address y /search para fijar el parser."""
    with httpx.Client(timeout=45.0, headers=_headers()) as cliente:
        a = cliente.get(
            f"{ZILLAPI_BASE}/properties/by-address", params={"address": address}
        )
        a.raise_for_status()
        subj = (a.json() or {}).get("data") or {}
        lat, lng = subj.get("latitude"), subj.get("longitude")
        out: dict = {
            "subject_keys": list(subj.keys()),
            "zpid": subj.get("zpid"),
            "lat": lat,
            "lng": lng,
            "homeType": subj.get("homeType"),
            "beds": subj.get("bedrooms"),
            "baths": subj.get("bathrooms"),
            "sqft": subj.get("livingArea"),
            "address_sample": subj.get("address"),
        }
        if not (isinstance(lat, (int, float)) and isinstance(lng, (int, float))):
            out["error"] = "sin lat/lng en la propiedad"
            return out

        body = {"filters": {"status": "sold", "bbox": _bbox(lat, lng, 2.0)}, "maxItems": 5}
        s = cliente.post(f"{ZILLAPI_BASE}/search", json=body)
        out["search_status"] = s.status_code
        try:
            sj = s.json()
        except Exception as e:  # noqa: BLE001
            out["search_parse_err"] = f"{type(e).__name__}: {str(e)[:150]}"
            out["search_text"] = s.text[:300]
            return out

        if isinstance(sj, dict):
            out["search_top_keys"] = list(sj.keys())
            lst = None
            for k in ("results", "listings", "data", "properties", "items", "homes"):
                if isinstance(sj.get(k), list):
                    lst = sj[k]
                    out["list_key"] = k
                    break
            if lst is None and isinstance(sj.get("data"), dict):
                out["data_keys"] = list(sj["data"].keys())
                for k, v in sj["data"].items():
                    if isinstance(v, list):
                        lst = v
                        out["list_key"] = f"data.{k}"
                        break
        elif isinstance(sj, list):
            lst = sj
            out["list_key"] = "(root)"
        else:
            lst = None

        if lst:
            out["n"] = len(lst)
            if isinstance(lst[0], dict):
                out["item0_keys"] = list(lst[0].keys())[:35]
                out["item0_sample"] = {
                    k: lst[0].get(k) for k in list(lst[0].keys())[:22]
                }
        else:
            out["no_list_found"] = True
            out["search_text"] = s.text[:400]
        return out
