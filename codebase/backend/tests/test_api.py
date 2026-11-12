from fastapi.testclient import TestClient

from app.models.responses import SimulationRequest


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "ScenariGo Backend" in data["service"]


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "/docs" in data["docs"]


def test_get_baseline_preset(client: TestClient):
    response = client.get("/api/v1/presets/bob-stationery")
    assert response.status_code == 200
    data = response.json()
    assert len(data["warehouses"]) == 3
    assert len(data["stores"]) == 3
    assert data["scenario_name"] == "Bob's Stationery Enterprise Baseline"


def test_get_deficit_preset(client: TestClient):
    response = client.get("/api/v1/presets/deficit-sample")
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_name"] == "East Malaysia Stockout Deficit"


def test_post_feasibility_baseline(client: TestClient, baseline_scenario: SimulationRequest):
    response = client.post("/api/v1/feasibility", json=baseline_scenario.model_dump())
    assert response.status_code == 200
    data = response.json()
    assert data["is_feasible"] is True
    assert data["deficits_count"] == 0
    assert len(data["tokens"]) == 3


def test_post_feasibility_deficit(client: TestClient, deficit_scenario: SimulationRequest):
    response = client.post("/api/v1/feasibility", json=deficit_scenario.model_dump())
    assert response.status_code == 200
    data = response.json()
    assert data["is_feasible"] is False
    assert data["deficits_count"] == 1
    assert any("[FAIL: INVENTORY DEFICIT]" in t["token_text"] for t in data["tokens"])
