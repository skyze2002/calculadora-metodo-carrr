"""Comparables probados sin red ni gasto de API (mock de Zillapi)."""

from __future__ import annotations

import httpx
import pytest

from api import comps
from api.limiter import limiter
from schemas.comps import CompsRequest


def subject_raw(**over):
    base = {
        "zpid": "100", "latitude": 37.80, "longitude": -79.50,
        "bedrooms": 3, "bathrooms": 2, "livingArea": 2000,
        "homeType": "SINGLE_FAMILY", "formattedAddress": "171 Main St, Lexington, VA",
        "zestimate": 210000, "propertyUrl": "https://www.zillow.com/homedetails/x/100_zpid/",
        "mainImage": "https://photos.zillowstatic.com/a.jpg",
    }
    base.update(over)
    return {"data": base}


def card(zpid, price, sqft=1500, status="sold", beds=3, baths=2, lat=37.81, lng=-79.51):
    return {
        "zpid": zpid, "listingStatus": status,
        "listingSoldPrice": {"amount": price} if status == "sold" else None,
        "listingPrice": {"amount": price},
        "listingAddress": {"full": f"{zpid} Oak St, Lexington, VA"},
        "coordinates": {"latitude": lat, "longitude": lng},
        "propertyUrl": f"https://www.zillow.com/homedetails/y/{zpid}_zpid/",
        "homeType": "SINGLE_FAMILY", "bedrooms": beds, "bathrooms": baths,
        "livingArea": sqft, "mainImage": "https://photos.zillowstatic.com/p.jpg",
        "dateSold": "2026-09-01",
    }


class FakeResp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status
        self.request = httpx.Request("GET", comps.ZILLAPI_BASE)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("e", request=self.request,
                response=httpx.Response(self.status_code, request=self.request))

    def json(self):
        return self._p


class FakeClient:
    def __init__(self, by_address, search_payloads):
        self.by_address = by_address
        self.search_payloads = list(search_payloads)
        self.posts = []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get(self, url, params=None):
        return FakeResp(self.by_address)

    def post(self, url, json=None):
        self.posts.append(json)
        payload = self.search_payloads.pop(0) if self.search_payloads else {"data": []}
        return FakeResp(payload)


def patch(monkeypatch, by_address, search_payloads):
    monkeypatch.setenv("ZILLAPI_KEY", "test-zk")
    fake = FakeClient(by_address, search_payloads)
    monkeypatch.setattr(comps.httpx, "Client", lambda **kw: fake)
    return fake


@pytest.fixture(autouse=True)
def reset_limits():
    limiter.reset()
    yield
    limiter.reset()


def test_parses_subject_comps_counts_and_arv(monkeypatch):
    patch(monkeypatch, subject_raw(), [
        {"data": [card("200", 200000, 1000), card("201", 240000, 1200)]},  # sold
        {"data": [card("300", 260000, 1300, status="for_sale")]},           # for_sale
    ])
    res = comps.buscar_comparables(CompsRequest(address="171 Main St, Lexington, VA"))
    assert res.subject.beds == 3 and res.subject.sqft == 2000
    assert res.subject.address == "171 Main St, Lexington, VA"
    assert {c.zpid for c in res.comps} == {"200", "201", "300"}
    assert res.counts == {"sold": 2, "for_sale": 1}
    assert res.relaxed is False
    # ARV = mediana precio/m² de vendidas (200 y 200) × 2000 = 400000
    assert res.arv_suggestion == "400000"
    primero = next(c for c in res.comps if c.zpid == "200")
    assert primero.price == "200000" and primero.price_per_sqft == "200"
    assert primero.status == "sold" and primero.image.startswith("https://")


def test_filters_derived_from_subject(monkeypatch):
    fake = patch(monkeypatch, subject_raw(), [{"data": [card("200", 200000)]}, {"data": []}])
    comps.buscar_comparables(CompsRequest(address="171 Main St", status="both"))
    f = fake.posts[0]["filters"]
    assert f["status"] == "sold"
    assert f["beds"] == {"min": 3, "max": 3}
    assert f["baths"] == {"min": 2}
    assert f["sqft"] == {"min": 1500, "max": 2500}
    assert f["homeTypes"] == ["house"]
    assert set(f["bbox"]) == {"west", "south", "east", "north"}


def test_relaxes_when_no_exact_matches(monkeypatch):
    fake = patch(monkeypatch, subject_raw(), [
        {"data": []},                       # sold tight -> vacío
        {"data": [card("200", 180000)]},    # sold relaxed -> hay
    ])
    res = comps.buscar_comparables(CompsRequest(address="171 Main St", status="sold"))
    assert res.relaxed is True
    assert len(fake.posts) == 2
    assert fake.posts[1]["filters"]["beds"] == {"min": 2, "max": 4}  # aflojado ±1
    assert [c.zpid for c in res.comps] == ["200"]


def test_excludes_subject_and_dedupes(monkeypatch):
    patch(monkeypatch, subject_raw(), [
        {"data": [card("100", 999999), card("200", 200000), card("200", 200000)]},
        {"data": []},
    ])
    res = comps.buscar_comparables(CompsRequest(address="171 Main St"))
    assert [c.zpid for c in res.comps] == ["200"]  # subject 100 fuera, 200 sin duplicar


def test_not_found_raises_valueerror(monkeypatch):
    patch(monkeypatch, {"data": {"zpid": "1"}}, [])  # sin lat/lng
    with pytest.raises(ValueError):
        comps.buscar_comparables(CompsRequest(address="171 Main St"))


def test_api_missing_config_and_auth_and_input(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.delenv("ZILLAPI_KEY", raising=False)
    assert client.post("/comps/search", json={"address": "171 Main St"}).status_code == 503
    assert client.post("/comps/search", json={"address": "x", "foo": 1}).status_code == 422
    monkeypatch.setenv("APP_KEY", "k")
    monkeypatch.setenv("ZILLAPI_KEY", "zk")
    assert client.post("/comps/search", json={"address": "171 Main St"}).status_code == 401


def test_api_returns_results(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    patch(monkeypatch, subject_raw(), [{"data": [card("200", 200000)]}, {"data": []}])
    r = client.post("/comps/search", json={"address": "171 Main St, Lexington, VA"})
    assert r.status_code == 200
    body = r.json()
    assert body["subject"]["beds"] == 3
    assert body["comps"][0]["zpid"] == "200"
    assert client.get("/deals").json() == []


def test_api_maps_zillapi_errors_and_never_leaks_the_key(client, monkeypatch, caplog):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.setenv("ZILLAPI_KEY", "zk_secreta")
    req = httpx.Request("GET", "https://api.zillapi.com/x")
    casos = [(402, 503, "créditos"), (401, 503, "no es válida"), (429, 429, "límite"),
             (404, 404, "No se encontró"), (500, 502, "No se pudieron")]
    for upstream, esperado, texto in casos:
        def fail(payload, upstream=upstream):
            raise httpx.HTTPStatusError(
                "x", request=req, response=httpx.Response(upstream, request=req))
        monkeypatch.setattr(comps, "buscar_comparables", fail)
        r = client.post("/comps/search", json={"address": "171 Main St, Lexington, VA"})
        assert r.status_code == esperado
        assert texto in r.json()["detail"]
        limiter.reset()
    # Se registra el código de Zillapi para diagnosticar, nunca la key.
    assert "HTTP 402" in caplog.text
    assert "zk_secreta" not in caplog.text
