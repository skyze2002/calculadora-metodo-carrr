"""Búsqueda de productos probada sin red, credenciales ni gasto de API."""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import openai
import pytest
from pydantic import ValidationError

from api import products
from api.limiter import limiter
from api.routers import products as router
from schemas.products import ProductCandidate, ProductResearch, ProductSearchRequest


def candidate(url="https://tienda.example/espejo", price="25.50", currency="USD", **extra):
    return ProductCandidate(title="Espejo sencillo", store="Tienda de ejemplo", url=url,
        price=price, currency=currency, price_note="Precio por unidad",
        shipping_note="Envío no confirmado", reason="Coincide con la medida pedida.", **extra)


@pytest.fixture(autouse=True)
def reset_limits():
    limiter.reset()
    yield
    limiter.reset()


def test_filters_budget_currency_sources_and_duplicates():
    request = ProductSearchRequest(category="mirrors", country="US", budget="30")
    research = ProductResearch(products=[candidate(price="29.99"),
        candidate(url="https://tienda.example/barato", price="10.10"),
        candidate(url="https://tienda.example/caro", price="30.01"),
        candidate(url="https://inventada.example/espejo"),
        candidate(url="https://tienda.example/pesos", currency="MXN"),
        candidate(price="5.00")])
    sources = {product.url: "Fuente" for product in research.products
               if "inventada" not in product.url}
    result = products.build_result(request, research, sources)
    assert [product.price for product in result.products] == ["10.10", "29.99"]
    assert result.currency == "USD"
    assert [source.url for source in result.sources] == [product.url for product in result.products]
    assert isinstance(result.model_dump()["products"][0]["price"], str)


def test_unknown_price_does_not_satisfy_budget():
    research = ProductResearch(products=[candidate(price=None)])
    sources = {research.products[0].url: "Fuente"}
    without_budget = ProductSearchRequest(category="mirrors", country="US")
    assert products.build_result(without_budget, research, sources).products[0].price is None
    with_budget = without_budget.model_copy(update={"budget": "100"})
    assert products.build_result(with_budget, research, sources).products == []


def test_decimal_prices_exactly_at_limit_and_zero():
    request = ProductSearchRequest(category="lighting", country="PE", budget="999999999.99")
    research = ProductResearch(products=[candidate(price="999999999.99", currency="PEN"),
        candidate(url="https://tienda.example/cero", price="0", currency="PEN")])
    sources = {product.url: "Fuente" for product in research.products}
    assert products.build_result(request, research, sources).products[0].price == "999999999.99"
    assert len(products.build_result(request, research, sources).products) == 1


@pytest.mark.parametrize("budget", ["0", "0.00", "-5", "NaN", "1e3", "1,000", "12.345", 20.0])
def test_invalid_or_non_string_budget_rejected(budget):
    with pytest.raises(ValidationError):
        ProductSearchRequest(category="mirrors", country="US", budget=budget)


@pytest.mark.parametrize("url", ["javascript:alert(1)", "https://localhost/x", "http://127.0.0.1/x",
    "http://10.0.0.1/x", "https://[::1]/x", "https://foo.internal/x", "https://u:p@example.com/x",
    "https://example.com:8000/x", "file:///etc/passwd", "https://exa mple.com/x"])
def test_untrusted_links_rejected(url):
    assert products.public_url(url) is None


def test_sources_accept_empty_optional_lists():
    assert products.search_sources([
        {"type": "web_search_call", "status": "completed", "action": {"sources": None}},
        {"type": "message", "content": [{"annotations": None}]},
    ]) == {}


def test_sources_are_extracted_from_tool_and_annotations_only():
    output = [
        {"type": "web_search_call", "status": "completed", "action": {"sources": [
            {"url": "https://tienda.example/uno", "title": "Producto uno"},
            {"url": "http://127.0.0.1/admin"}]}},
        {"type": "message", "content": [{"text": "https://inventada.example/ignorar", "annotations": [
            {"type": "url_citation", "url": "https://tienda.example/dos#precio", "title": "Producto dos"}]}]},
    ]
    assert products.search_sources(output) == {"https://tienda.example/uno": "Producto uno",
                                              "https://tienda.example/dos": "Producto dos"}


def test_search_requires_web_and_uses_structured_extraction(monkeypatch):
    calls = {}
    url = "https://tienda.example/espejo"
    output_item = SimpleNamespace(model_dump=lambda: {"type": "web_search_call", "status": "completed",
                                                      "action": {"sources": [{"url": url}]}})
    def create(**kwargs):
        calls["search"] = kwargs
        return SimpleNamespace(status="completed", output=[output_item], output_text="Informe con precio y fuente")
    def parse(**kwargs):
        calls["parse"] = kwargs
        return SimpleNamespace(status="completed", output_parsed=ProductResearch(products=[candidate()]))
    monkeypatch.setattr(products.openai, "OpenAI", lambda **kwargs: SimpleNamespace(responses=SimpleNamespace(create=create, parse=parse)))
    request = ProductSearchRequest(category="mirrors", country="US", city="Miami", region="Florida")
    assert products.search_products(request).products[0].url == url
    assert calls["search"]["tool_choice"] == "required"
    assert calls["search"]["tools"][0]["type"] == "web_search"
    assert calls["search"]["tools"][0]["user_location"]["city"] == "Miami"
    assert calls["search"]["tools"][0]["user_location"]["region"] == "Florida"
    assert calls["search"]["tools"][0]["user_location"]["country"] == "US"
    assert calls["search"]["store"] is False
    assert calls["parse"]["text_format"] is ProductResearch
    assert calls["parse"]["store"] is False


def test_city_and_state_optional_and_state_bounded():
    request = ProductSearchRequest(category="mirrors", country="US")
    assert request.city == request.region == ""
    assert ProductSearchRequest(category="mirrors", country="US", region=" Florida ").region == "Florida"
    with pytest.raises(ValidationError):
        ProductSearchRequest(category="mirrors", country="US", region="a" * 81)


def test_search_without_web_call_fails(monkeypatch):
    monkeypatch.setattr(products.openai, "OpenAI", lambda **kwargs: SimpleNamespace(responses=SimpleNamespace(
        create=lambda **kwargs: SimpleNamespace(status="completed", output=[], output_text="Una oferta inventada"))))
    with pytest.raises(ValueError, match="búsqueda web"):
        products.search_products(ProductSearchRequest(category="lighting", country="US"))


def test_api_reports_missing_configuration(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/products/search", json={"category": "mirrors", "country": "US"})
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_api_returns_results_without_database_writes(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")
    def fake_search(payload):
        product = candidate()
        return products.build_result(payload, ProductResearch(products=[product]), {product.url: "Fuente"})
    monkeypatch.setattr(router, "search_products", fake_search)
    response = client.post("/products/search", json={"category": "mirrors", "country": "US"})
    assert response.status_code == 200
    assert response.json()["products"][0]["price"] == "25.50"
    assert client.get("/deals").json() == []


def test_api_rejects_invalid_input_and_unauthorized_requests(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    assert client.post("/products/search", json={"category": "mirrors", "country": "XX"}).status_code == 422
    assert client.post("/products/search", json={"category": "mirrors", "country": "US", "budget": 20}).status_code == 422
    assert client.post("/products/search", json={"category": "mirrors", "country": "US", "property_address": "No enviar"}).status_code == 422
    monkeypatch.setenv("APP_KEY", "test-app-key")
    assert client.post("/products/search", json={"category": "mirrors", "country": "US"}).status_code == 401


def test_api_translates_provider_errors(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")
    errors = [
        (ValueError("JSON inválido"), 502),
        (openai.AuthenticationError("bad key", response=httpx.Response(401,
            request=httpx.Request("POST", "https://api.openai.com")), body=None), 503),
        (openai.RateLimitError("quota", response=httpx.Response(429,
            request=httpx.Request("POST", "https://api.openai.com")), body=None), 429),
    ]
    for error, status in errors:
        def fail(payload):
            raise error
        monkeypatch.setattr(router, "search_products", fail)
        response = client.post("/products/search", json={"category": "mirrors", "country": "US"})
        assert response.status_code == status


def test_api_limits_search_requests(client, monkeypatch):
    monkeypatch.delenv("APP_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    for _ in range(5):
        assert client.post("/products/search", json={"category": "mirrors", "country": "US"}).status_code == 503
    assert client.post("/products/search", json={"category": "mirrors", "country": "US"}).status_code == 429
