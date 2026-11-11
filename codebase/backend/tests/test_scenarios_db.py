"""Unit tests for SQLite Scenario & Master Data Persistence Layer."""

import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import init_db
from app.models.entities import Warehouse, Store, ProductItem
from app.models.responses import SimulationRequest


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path):
    """Configures a clean isolated SQLite database per test function."""
    db_file = tmp_path / "test_scenarigo.db"
    os.environ["SCENARIGO_DB_PATH"] = str(db_file)
    init_db()
    yield
    if "SCENARIGO_DB_PATH" in os.environ:
        del os.environ["SCENARIGO_DB_PATH"]


@pytest.fixture
def client():
    return TestClient(app)


def test_presets_auto_seeded(client):
    """Verifies that the 4 factory presets are auto-seeded on database initialization."""
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 200
    scenarios = response.json()
    assert len(scenarios) >= 4

    preset_ids = {s["scenario_id"] for s in scenarios}
    assert "bob-stationery" in preset_ids
    assert "deficit-sample" in preset_ids
    assert "air-freight" in preset_ids
    assert "tri-port" in preset_ids

    # Active scenario must be bob-stationery by default
    active = next(s for s in scenarios if s["is_active"])
    assert active["scenario_id"] == "bob-stationery"


def test_get_active_scenario(client):
    """Verifies retrieval of currently active scenario."""
    response = client.get("/api/v1/scenarios/active")
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_id"] == "bob-stationery"
    assert len(data["warehouses"]) == 3
    assert len(data["stores"]) == 3


def test_create_and_activate_custom_scenario(client):
    """Verifies creating and activating a custom scenario."""
    new_scenario = SimulationRequest(
        scenario_id="custom-test-01",
        scenario_name="Kuantan Regional Depot Trial",
        warehouses=[
            Warehouse(
                warehouse_id=10,
                name="Kuantan Supply Hub",
                latitude=3.8077,
                longitude=103.3260,
                inventory={"0": 100, "1": 50},
            )
        ],
        stores=[
            Store(
                store_id=20,
                name="Temerloh Retail Branch",
                latitude=3.4506,
                longitude=102.4175,
                requests={"0": 40},
            )
        ],
        products=[
            ProductItem(
                product_id="0",
                name="Test Paper",
                sku="PAP-TEST",
                unit_weight_kg=10.0,
                low_stock_threshold=20,
            )
        ],
        budget_cap_myr=5500.0,
    )

    create_res = client.post("/api/v1/scenarios", json=new_scenario.model_dump())
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["scenario_id"] == "custom-test-01"
    assert created["is_preset"] is False

    # Verify that it is now the active scenario
    active_res = client.get("/api/v1/scenarios/active")
    assert active_res.status_code == 200
    assert active_res.json()["scenario_id"] == "custom-test-01"


def test_update_preset_and_factory_reset(client):
    """Verifies that editing a preset marks it modified, and reset restores baseline state."""
    # 1. Fetch Bob's baseline
    bob_res = client.get("/api/v1/scenarios/bob-stationery")
    assert bob_res.status_code == 200
    bob_data = bob_res.json()
    assert bob_data["is_modified"] is False
    original_budget = bob_data["budget_cap_myr"]

    # 2. Update Bob's budget
    bob_data["budget_cap_myr"] = 15000.0
    put_res = client.put("/api/v1/scenarios/bob-stationery", json=bob_data)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["budget_cap_myr"] == 15000.0
    assert updated["is_modified"] is True

    # Check scenario list displays is_modified=True
    list_res = client.get("/api/v1/scenarios")
    bob_summary = next(s for s in list_res.json() if s["scenario_id"] == "bob-stationery")
    assert bob_summary["is_modified"] is True

    # 3. Reset preset to factory
    reset_res = client.post("/api/v1/scenarios/bob-stationery/reset")
    assert reset_res.status_code == 200
    restored = reset_res.json()
    assert restored["budget_cap_myr"] == original_budget
    assert restored["is_modified"] is False


def test_delete_custom_scenario_and_preset_protection(client):
    """Verifies custom scenarios can be deleted, while factory presets reject deletion."""
    # 1. Attempting to delete a preset must fail
    fail_res = client.delete("/api/v1/scenarios/bob-stationery")
    assert fail_res.status_code == 400
    assert "Factory presets cannot be deleted" in fail_res.json()["detail"]

    # 2. Create custom scenario then delete it
    custom_scen = SimulationRequest(
        scenario_id="temp-deletable",
        scenario_name="Temporary Scenario",
        warehouses=[
            Warehouse(
                warehouse_id=1,
                name="Temp WH",
                latitude=3.1390,
                longitude=101.6869,
                inventory={"0": 10},
            )
        ],
        stores=[
            Store(
                store_id=1,
                name="Temp Store",
                latitude=3.0738,
                longitude=101.5183,
                requests={"0": 5},
            )
        ],
    )
    client.post("/api/v1/scenarios", json=custom_scen.model_dump())

    del_res = client.delete("/api/v1/scenarios/temp-deletable")
    assert del_res.status_code == 204

    # Confirm it is gone
    check_res = client.get("/api/v1/scenarios/temp-deletable")
    assert check_res.status_code == 404
