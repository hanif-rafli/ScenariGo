"""Unit tests for Tri-Port Multi-Gateway Peninsular Logistics and realistic GIS corridors."""

import pytest
from fastapi.testclient import TestClient

from app.core.stage1_feasibility import check_global_feasibility
from app.core.stage2_reachability import evaluate_reachability, get_corridor_waypoints
from app.core.stage3_network_flow import solve_network_flow
from app.core.stage4_fleet_routing import solve_fleet_routing
from app.data.presets import get_tri_port_preset
from app.main import app
from app.models.graph import Modality


@pytest.fixture
def client():
    return TestClient(app)


def test_corridor_butterworth_nbct():
    """Verifies highway and maritime corridor resolution for Butterworth NBCT."""
    c_bw = (5.4120, 100.3700)
    c_ipoh = (4.5975, 101.0901)
    pts, dist, mod = get_corridor_waypoints(
        "Butterworth Logistics Depot", "Ipoh Supermarket", c_bw, c_ipoh
    )
    assert mod == Modality.LAND
    assert dist == 153.2
    assert len(pts) > 10
    assert pts[0] == c_bw


def test_corridor_port_klang():
    """Verifies highway and maritime corridor resolution for Port Klang Gateway."""
    c_klang = (2.9985, 101.3928)
    c_sa = (3.0738, 101.5183)
    pts, dist, mod = get_corridor_waypoints("Port Klang Gateway", "Shah Alam Retail", c_klang, c_sa)
    assert mod == Modality.LAND
    assert dist == 18.5
    assert len(pts) == 11
    assert pts[0] == c_klang

    # Maritime fairway to Kuching
    c_kch = (1.5533, 110.3592)
    pts_sea, dist_sea, mod_sea = get_corridor_waypoints(
        "Port Klang Gateway", "Kuching Transshipment Port", c_klang, c_kch
    )
    assert mod_sea == Modality.MARITIME
    assert dist_sea == 1320.0
    assert len(pts_sea) > 15


def test_corridor_ptp_johor():
    """Verifies highway and maritime corridor resolution for Port of Tanjung Pelepas."""
    c_ptp = (1.3620, 103.5510)
    c_jb = (1.4927, 103.7414)
    pts, dist, mod = get_corridor_waypoints(
        "Port of Tanjung Pelepas", "Johor Bahru Retail", c_ptp, c_jb
    )
    assert mod == Modality.LAND
    assert dist == 28.5
    assert len(pts) == 5
    assert pts[0] == c_ptp

    # Maritime fairway to Kuching (840 km deepwater fairway clearing Tanjung Datu at >= 2.42N)
    c_kch = (1.5533, 110.3592)
    pts_sea, dist_sea, mod_sea = get_corridor_waypoints(
        "Port of Tanjung Pelepas (PTP Johor)", "Kuching Transshipment Port", c_ptp, c_kch
    )
    assert mod_sea == Modality.MARITIME
    assert dist_sea == 840.0
    assert any(lat >= 2.40 for lat, lon in pts_sea)


def test_tri_port_api_endpoint(client):
    """Verifies that the /api/v1/presets/tri-port endpoint returns the scenario request."""
    response = client.get("/api/v1/presets/tri-port")
    assert response.status_code == 200
    data = response.json()
    assert len(data["warehouses"]) == 5
    assert len(data["stores"]) == 4
    assert any("Butterworth" in w["name"] for w in data["warehouses"])
    assert any("Port Klang" in w["name"] for w in data["warehouses"])
    assert any("Tanjung Pelepas" in w["name"] for w in data["warehouses"])


def test_tri_port_four_stage_pipeline():
    """Verifies the complete 4-stage optimization pipeline on the Tri-Port scenario."""
    preset = get_tri_port_preset()

    # Stage 1: Feasibility
    res1 = check_global_feasibility(preset.warehouses, preset.stores)
    assert res1.is_feasible is True
    assert res1.deficits_count == 0

    # Stage 2: Reachability
    res2 = evaluate_reachability(preset.warehouses, preset.stores)
    assert len(res2.components) == 2
    assert len(res2.intermodal_routes) > 0

    # Stage 3: Network Flow
    res3 = solve_network_flow(preset.warehouses, preset.stores)
    assert res3.is_flow_feasible is True
    assert res3.total_demand_satisfied == res3.total_demand_requested
    assert len(res3.allocations) > 0

    # Verify that maritime allocations exist and use valid corridors
    maritime_allocs = [a for a in res3.allocations if a.modality == Modality.MARITIME]
    assert len(maritime_allocs) > 0
    for ma in maritime_allocs:
        assert ma.path_coordinates is not None
        assert len(ma.path_coordinates) > 5

    # Stage 4: Fleet Routing
    res4 = solve_fleet_routing(
        res3.allocations,
        preset.warehouses,
        preset.stores,
        budget_cap_myr=preset.budget_cap_myr,
    )
    assert res4.is_budget_feasible is True
    assert len(res4.itineraries) > 0
    assert len(res4.available_trucks) >= 5
