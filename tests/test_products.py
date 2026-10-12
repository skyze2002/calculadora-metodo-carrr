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
    # Preferidas primero (en su orden); Ollie's completa la lista al final.
    assert [p.store for p in result.products] == ["Walmart", "Amazon.com", "Ollie's Bargain Outlet"]
    primero = result.products[0]
    assert primero.price == "19.00"
    assert primero.image == "https://encrypted-tbn0.gstatic.com/img.jpg"
    assert primero.url == "https://www.walmart.com/ip/1"
    assert primero.currency == "USD"
    assert primero.rating == 4.5
    assert result.model_dump()["products"][0]["price"] == "19.00"


def test_other_stores_fill_up_to_max_after_preferred(monkeypatch):
    otras = [shopping(source=f"Tienda {i}", product_link=f"https://t{i}.example/p") for i in range(10)]
    pref = [shopping(source="Home Depot", product_link="https://www.homedepot.com/p/1")]
    patch_serpapi(monkeypatch, {"shopping_results": otras + pref})
    result = products.search_products(ProductSearchRequest(category="mirrors", country="US"))
    assert len(result.products) == products.MAX_PRODUCTS
    assert result.products[0].store == "Home Depot"
    assert [p.store for p in result.products[1:]] == [f"Tienda {i}" for i in range(7)]


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
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    # US + detalle en español -> inglés (sin IA configurada: glosario).
    products.search_products(ProductSearchRequest(category="mirrors", country="US", details="espejo ovalado"))
    assert captura["q"] == "mirror oval"
    # Otros mercados buscan en español, tal cual.
    products.search_products(ProductSearchRequest(category="mirrors", country="MX", details="espejo ovalado"))
    assert captura["q"] == "espejo ovalado"
    # Un detalle que ya está en inglés no se toca.
    products.search_products(ProductSearchRequest(category="mirrors", country="US", details="oval mirror 24 inch"))
    assert captura["q"] == "oval mirror 24 inch"
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


# --- Traducción del detalle al inglés (mercado US) ---

@pytest.mark.parametrize("texto,esperado", [
    ("grifo negro para lavamanos", "faucet black bathroom sink"),
    ("espejo redondo de 24 pulgadas, sin luz", "mirror round 24 inch without light"),
    ("Tiradores negros de 128 mm, paquete de 10", "pull handles black 128 mm pack 10"),
    ("barra para cortina de 120 cm", "rod curtain 120 cm"),
])
def test_glossary_translation(texto, esperado):
    assert products._parece_espanol(texto)
    assert products._traducir_glosario(texto) == esperado


@pytest.mark.parametrize("texto", ["round mirror 24 inch", "matte black faucet", "Moen 7594"])
def test_english_details_are_not_detected_as_spanish(texto):
    assert not products._parece_espanol(texto)


class FakeOpenAI:
    """Cliente de OpenAI falso: devuelve `respuesta` o lanza `error`."""

    def __init__(self, respuesta=None, error=None):
        self.respuesta, self.error, self.mensajes = respuesta, error, None
        outer = self

        class _Completions:
            def create(self, **kw):
                outer.mensajes = kw["messages"]
                if outer.error:
                    raise outer.error

                class _Msg:
                    content = outer.respuesta

                class _Choice:
                    message = _Msg()

                class _Resp:
                    choices = [_Choice()]

                return _Resp()

        class _Chat:
            completions = _Completions()

        self.chat = _Chat()


def patch_openai(monkeypatch, fake):
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai")
    monkeypatch.setattr(products.openai, "OpenAI", lambda **kw: fake)
    monkeypatch.setattr(products, "_cache_consultas", {})


def test_ai_translation_is_used_when_valid(monkeypatch):
    fake = FakeOpenAI(respuesta='"Matte Black Bathroom Sink Faucet"')
    patch_openai(monkeypatch, fake)
    q = products._consulta(ProductSearchRequest(category="faucets", country="US",
                                                details="grifo negro mate para lavamanos"))
    assert q == "matte black bathroom sink faucet"
    # La categoría va como contexto y el idioma destino es el del mercado.
    assert "English" in fake.mensajes[0]["content"]
    assert "faucet" in fake.mensajes[0]["content"]
    # Sólo viaja el detalle de la búsqueda, como dato del usuario.
    assert fake.mensajes[-1] == {"role": "user", "content": "grifo negro mate para lavamanos"}


@pytest.mark.parametrize("salida", [
    "Sure! Here is the query:\nblack faucet",   # varias líneas
    "<script>alert(1)</script>",                 # caracteres fuera de lo permitido
    "x" * 200,                                   # demasiado largo
    "",                                          # vacío
    None,
])
def test_ai_output_is_validated_and_falls_back_to_glossary(monkeypatch, salida):
    patch_openai(monkeypatch, FakeOpenAI(respuesta=salida))
    q = products._consulta(ProductSearchRequest(category="faucets", country="US",
                                                details="grifo negro"))
    assert q == "faucet black"


def test_ai_failure_never_breaks_the_search(monkeypatch):
    patch_openai(monkeypatch, FakeOpenAI(error=RuntimeError("timeout")))
    q = products._consulta(ProductSearchRequest(category="mirrors", country="US",
                                                details="espejo redondo"))
    assert q == "mirror round"


def test_english_and_other_markets_are_also_normalized(monkeypatch):
    # Español o inglés -> la misma query canónica (como Google).
    fake = FakeOpenAI(respuesta="black bathroom sink faucet")
    patch_openai(monkeypatch, fake)
    q = products._consulta(ProductSearchRequest(category="faucets", country="US",
                                                details="Black faucet for bathroom sink"))
    assert q == "black bathroom sink faucet"
    # Otros mercados: query canónica en español.
    fake.respuesta = "espejo redondo"
    q = products._consulta(ProductSearchRequest(category="mirrors", country="ES",
                                                details="round mirror"))
    assert q == "espejo redondo"
    assert "Spanish" in fake.mensajes[0]["content"]


def test_no_ai_call_without_details(monkeypatch):
    fake = FakeOpenAI(respuesta="should not be used")
    patch_openai(monkeypatch, fake)
    assert products._consulta(ProductSearchRequest(category="mirrors", country="US")) == "mirror"
    assert fake.mensajes is None


def test_same_details_are_cached_and_failures_are_not(monkeypatch):
    llamadas = []
    fake = FakeOpenAI(respuesta="round mirror")
    patch_openai(monkeypatch, fake)
    original = fake.chat.completions.create

    def contar(**kw):
        llamadas.append(kw)
        return original(**kw)

    fake.chat.completions.create = contar
    req = dict(category="mirrors", country="US")
    products._consulta(ProductSearchRequest(**req, details="espejo redondo"))
    products._consulta(ProductSearchRequest(**req, details="  Espejo   REDONDO "))
    assert len(llamadas) == 1  # misma búsqueda -> misma query, sin otra llamada

    fake.error = RuntimeError("caída")
    products._consulta(ProductSearchRequest(**req, details="espejo ovalado"))
    fake.error = None
    products._consulta(ProductSearchRequest(**req, details="espejo ovalado"))
    assert len(llamadas) == 3  # el fallo no quedó cacheado


def test_cache_is_bounded(monkeypatch):
    patch_openai(monkeypatch, FakeOpenAI(respuesta="mirror"))
    monkeypatch.setattr(products, "_CACHE_MAX", 3)
    for i in range(10):
        products._consulta(ProductSearchRequest(category="mirrors", country="US", details=f"espejo {i}"))
    assert len(products._cache_consultas) == 3
