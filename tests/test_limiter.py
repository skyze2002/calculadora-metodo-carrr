"""PROTECCIÓN: la IP del rate limit no se puede falsificar con X-Forwarded-For."""

from __future__ import annotations

from starlette.requests import Request

from api.limiter import _client_key


def pedido(xff: str | None, directa: str = "172.18.0.5") -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff is not None else []
    return Request({"type": "http", "headers": headers, "client": (directa, 1234)})


def test_un_proxy_toma_la_ultima_entrada(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    # El cliente inventó "1.1.1.1"; Caddy agregó la IP real al final.
    assert _client_key(pedido("1.1.1.1, 203.0.113.7")) == "203.0.113.7"
    assert _client_key(pedido("203.0.113.7")) == "203.0.113.7"


def test_inventar_ips_distintas_no_cambia_la_clave(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    claves = {_client_key(pedido(f"10.0.0.{i}, 203.0.113.7")) for i in range(50)}
    assert claves == {"203.0.113.7"}


def test_cloudflare_mas_caddy_toma_la_anteultima(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "2")
    # [lo que inventó el cliente, IP real (la agrega Cloudflare), borde de CF (la agrega Caddy)]
    assert _client_key(pedido("9.9.9.9, 203.0.113.7, 172.70.1.1")) == "203.0.113.7"


def test_sin_proxy_o_encabezado_corto_usa_la_conexion(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "0")
    assert _client_key(pedido("1.1.1.1")) == "172.18.0.5"
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "2")
    assert _client_key(pedido("1.1.1.1")) == "172.18.0.5"
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    assert _client_key(pedido(None)) == "172.18.0.5"
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "basura")
    assert _client_key(pedido("1.1.1.1, 203.0.113.7")) == "203.0.113.7"
