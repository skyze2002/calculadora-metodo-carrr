"""Tests de los endpoints de deals (con SQLite en memoria, ver conftest)."""

from __future__ import annotations

from fastapi.testclient import TestClient

# El deal de ejemplo acordado. Todo el dinero como string.
DEAL_EJEMPLO = {
    "name": "Casa ejemplo",
    "purchase_price": "100000",
    "rehab_budget": "30000",
    "arv": "180000",
    "ltc": "0.90",
    "monthly_interest_rate": "0.005",
    "points": "0.02",
    "ltv": "0.75",
    "seasoning_months": 6,
    "closing_costs": "4000",
}


def test_create_deal_guarda_y_devuelve_resultado(client: TestClient) -> None:
    """POST /deals guarda el deal y devuelve el resultado recalculado."""
    resp = client.post("/deals", json=DEAL_EJEMPLO)
    assert resp.status_code == 201
    data = resp.json()

    assert isinstance(data["id"], int)
    assert data["name"] == "Casa ejemplo"
    # El dinero vuelve como string, nunca como numero.
    assert data["purchase_price"] == "100000.00"
    assert data["result"]["trapped_cash"] == "1340.00"
    assert data["result"]["payoff"] == "119340.00"


def test_list_deals_devuelve_lo_guardado(client: TestClient) -> None:
    """GET /deals lista los deals guardados."""
    assert client.get("/deals").json() == []

    client.post("/deals", json=DEAL_EJEMPLO)
    client.post("/deals", json={**DEAL_EJEMPLO, "name": "Otra casa"})

    data = client.get("/deals").json()
    assert len(data) == 2
    # Orden: del mas nuevo al mas viejo.
    assert data[0]["name"] == "Otra casa"


def test_get_deal_por_id(client: TestClient) -> None:
    """GET /deals/{id} trae el deal guardado."""
    creado = client.post("/deals", json=DEAL_EJEMPLO).json()
    resp = client.get(f"/deals/{creado['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == creado["id"]


def test_get_deal_inexistente_da_404(client: TestClient) -> None:
    """GET /deals/{id} con id que no existe devuelve 404."""
    assert client.get("/deals/9999").status_code == 404


def test_dinero_nunca_es_numero_en_el_json(client: TestClient) -> None:
    """Todos los montos viajan como string en el JSON (regla 1)."""
    data = client.post("/deals", json=DEAL_EJEMPLO).json()
    montos = [
        data["purchase_price"],
        data["closing_costs"],
        *data["result"].values(),
    ]
    for monto in montos:
        assert isinstance(monto, str)
