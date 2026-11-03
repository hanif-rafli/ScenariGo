import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.data.presets import get_bobs_stationery_preset, get_deficit_preset
from app.models.responses import SimulationRequest


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def baseline_scenario() -> SimulationRequest:
    return get_bobs_stationery_preset()


@pytest.fixture
def deficit_scenario() -> SimulationRequest:
    return get_deficit_preset()
