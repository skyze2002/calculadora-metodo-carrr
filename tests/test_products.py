"""Búsqueda de productos (Google Shopping/SerpAPI) probada sin red ni gasto."""

from __future__ import annotations

import httpx
import pytest
from pydantic import ValidationError

from api import products
from api.limiter import limiter
from schemas.products import ProductItem, ProductSearchRequest, ProductSearchResult


def shopping(**over):
    """Un shopping_result de SerpAPI de ejemplo."""
    base = {
        "title": "Espejo redondo 24\"",
        "source": "Amazon.com",
        "product_link": "https://www.amazon.com/dp/ABC",
        "thumbnail": "https://encrypted-tbn0.gstatic.com/img.jpg",
        "extracted_price": 25.5,
        "rating": 4.5,
        "delivery": "Free delivery",
    }
    base.update(over)
    return base


class FakeResp:
    def __init__(self, payload, status=200):
        self._p = payload
        self.status_code = status
        self.request = httpx.Request("GET", products.SERPAPI_URL)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "err",
                request=self.request,
                response=httpx.Response(self.status_code, request=self.request),
            )

    def json(self):
        return self._p


class FakeClient:
    def __init__(self, resp):
        self._resp = resp

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get(self, url, params=None):
        return self._resp


def patch_serpapi(monkeypatch, payload, status=200):
    monkeypatch.setenv("SERPAPI_KEY", "test-serp")
    monkeypatch.setattr(
        products.httpx, "Client", lambda **kw: FakeClient(FakeResp(payload, status))
    )


@pytest.fixture(autouse=True)
def reset_limits():
    limiter.reset()
    yield
    limiter.reset()


def test_maps_fields_and_prefers_big_stores(monkeypatch):
    payload = {"shopping_results": [
        shopping(source="Ollie's Bargain Outlet", product_link="https://ollies.example/e"),
        shopping(source="Walmart", product_link="https://www.walmart.com/ip/1", extracted_price=19.0),
        shopping(source="Amazon.com", product_link="https://www.amazon.com/dp/ABC"),
    ]}
    patch_serpapi(monkeypatch, payload)
    result = products.search_products(ProductSearchRequest(category="mirrors", country="US"))
    # Ollie's queda afuera porque hay tiendas preferidas (Walmart, Amazon).
    assert [p.store for p in result.products] == ["Walmart", "Amazon.com"]
    primero = result.products[0]
    assert primero.price == "19.00"
    assert primero.image == "https://encrypted-tbn0.gstatic.com/img.jpg"
    assert primero.url == "https://www.walmart.com/ip/1"
    assert primero.currency == "USD"
    assert primero.rating == 4.5
    assert result.model_dump()["products"][0]["price"] == "19.00"


def test_falls_back_to_other_stores_when_no_preferred(monkeypatch):
    payload = {"shopping_results": [shopping(source="Ollie's", product_link="https://ollies.example/e")]}
    patch_serpapi(monkeypatch, payload)
    result = products.search_products(ProductSearchRequest(category="mirrors", country="US"))
    assert [p.store for p in result.products] == ["Ollie's"]


def test_budget_drops_expensive_and_unknown_prices(monkeypatch):
    payload = {"shopping_results": [
        shopping(source="Amazon", product_link="https://www.amazon.com/a", extracted_price=29.99),
        shopping(source="Walmart", product_link="https://www.walmart.com/b", extracted_price=30.01),
        shopping(source="Lowe's", product_link="https://www.lowes.com/c", extracted_price=None),
    ]}
    patch_serpapi(monkeypatch, payload)
    req = ProductSearchRequest(category="mirrors", country="US", budget="30")
    result = products.search_products(req)
    assert [p.price for p in result.products] == ["29.99"]


def test_dedup_and_requires_title_and_link(monkeypatch):
    payload = {"shopping_results": [
        shopping(source="Amazon", product_link="https://www.amazon.com/x"),
        shopping(source="Amazon", product_link="https://www.amazon.com/x"),  # duplicado
        shopping(title="", source="Amazon", product_link="https://www.amazon.com/y"),  # sin título
        shopping(source="Amazon", product_link="javascript:alert(1)"),  # link inseguro
    ]}
    patch_serpapi(monkeypatch, payload)
    result = products.search_products(ProductSearchRequest(category="mirrors", country="US"))
    assert [p.url for p in result.products] == ["https://www.amazon.com/x"]


def test_requires_serpapi_key(monkeypatch):
    monkeypatch.delenv("SERPAPI_KEY", raising=False)
    with pytest.raises(ValueError):
        products.search_products(ProductSearchRequest(category="mirrors", country="US"))


def test_query_uses_details_then_category(monkeypatch):
    captura = {}
    monkeypatch.setenv("SERPAPI_KEY", "test-serp")

    def fake_client(**kw):
        class C(FakeClient):
            def get(self, url, params=None):
                captura.update(params)
                return FakeResp({"shopping_results": []})
        return C(None)

    monkeypatch.setattr(products.httpx, "Client", fake_client)
    products.search_products(ProductSearchRequest(category="mirrors", country="US", details="espejo ovalado"))
    assert captura["q"] == "espejo ovalado"
    products.search_products(ProductSearchRequest(category="mirrors", country="US"))
    assert captura["q"] == "mirror"  # término en inglés para US


@pytest.mark.parametrize("url", ["javascript:alert(1)", "https://localhost/x", "http://127.0.0.1/x",
    "http://10.0.0.1/x", "https://[::1]/x", "https://foo.internal/x", "https://u:p@example.com/x",
    "https://example.com:8000/x", "file:///etc/passwd", "https://exa mple.com/x"])
def test_untrusted_links_rejected(url):
    assert products.public_url(url) is None


def test_public_url_encodes_spaces_in_query():
    # Google Shopping deja espacios sin escapar en product_link; se codifican.
    assert (products.public_url("https://www.google.com/search?q=round bathroom mirror")
            == "https://www.google.com/search?q=round%20bathroom%20mirror")


@pytest.mark.parametrize("budget", ["0", "0.00", "-5", "NaN", "1e3", "1,000", "12.345", 20.0])
def test_invalid_or_non_string_budget_rejected(budget):
    with pytest.raises(ValidationError):
        ProductSearchRequest(category="mirrors", country="US", budget=budget)


def test_api_reports_missing_configuration(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.delenv("SERPAPI_KEY", raising=False)
    response = client.post("/products/search", json={"category": "mirrors", "country": "US"})
    assert response.status_code == 503
    assert "SERPAPI_KEY" in response.json()["detail"]


def test_api_returns_results_without_database_writes(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.setenv("SERPAPI_KEY", "test-serp")

    def fake_search(payload):
        return ProductSearchResult(
            products=[ProductItem(title="Espejo", store="Amazon", url="https://www.amazon.com/x",
                image="https://encrypted-tbn0.gstatic.com/i.jpg", price="25.50", currency="USD",
                rating=4.0, delivery="Free")],
            searched_at="2026-10-05T12:00:00+00:00", country="US", currency="USD",
            query="mirror", message="ok")

    monkeypatch.setattr(products, "search_products", fake_search)
    response = client.post("/products/search", json={"category": "mirrors", "country": "US"})
    assert response.status_code == 200
    body = response.json()
    assert body["products"][0]["price"] == "25.50"
    assert body["products"][0]["image"].startswith("https://")
    assert client.get("/deals").json() == []


def test_api_rejects_invalid_input_and_unauthorized_requests(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    assert client.post("/products/search", json={"category": "mirrors", "country": "XX"}).status_code == 422
    assert client.post("/products/search", json={"category": "mirrors", "country": "US", "budget": 20}).status_code == 422
    assert client.post("/products/search", json={"category": "mirrors", "country": "US", "foo": "x"}).status_code == 422
    monkeypatch.setenv("APP_KEY", "test-app-key")
    monkeypatch.setenv("SERPAPI_KEY", "test-serp")
    assert client.post("/products/search", json={"category": "mirrors", "country": "US"}).status_code == 401


def test_api_translates_provider_errors(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.setenv("SERPAPI_KEY", "test-serp")
    req = httpx.Request("GET", products.SERPAPI_URL)
    casos = [
        (ValueError("inválido"), 502),
        (httpx.ConnectError("sin red"), 502),
        (httpx.HTTPStatusError("x", request=req, response=httpx.Response(401, request=req)), 503),
        (httpx.HTTPStatusError("x", request=req, response=httpx.Response(429, request=req)), 429),
    ]
    for error, status in casos:
        def fail(payload):
            raise error
        monkeypatch.setattr(products, "search_products", fail)
        response = client.post("/products/search", json={"category": "mirrors", "country": "US"})
        assert response.status_code == status


def test_api_limits_search_requests(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.delenv("SERPAPI_KEY", raising=False)
    for _ in range(5):
        assert client.post("/products/search", json={"category": "mirrors", "country": "US"}).status_code == 503
    assert client.post("/products/search", json={"category": "mirrors", "country": "US"}).status_code == 429
