from fastapi.testclient import TestClient
from app.core.stage2_reachability import evaluate_reachability
from app.models.responses import SimulationRequest
from app.models.graph import Modality


def test_partitioning_baseline(baseline_scenario: SimulationRequest):
    result = evaluate_reachability(
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
    )

    # Exactly 2 disconnected components: Peninsular and Borneo
    assert len(result.components) == 2

    comp_pen = next(c for c in result.components if "Peninsular" in c.name)
    comp_bor = next(c for c in result.components if "Borneo" in c.name)

    # Peninsular: W0, W1, S0, S1
    assert set(comp_pen.warehouse_ids) == {0, 1}
    assert set(comp_pen.store_ids) == {0, 1}
    assert comp_pen.is_self_sufficient is True

    # Borneo: W2, S2
    assert set(comp_bor.warehouse_ids) == {2}
    assert set(comp_bor.store_ids) == {2}
    assert comp_bor.is_self_sufficient is False
    assert "2" in comp_bor.unmet_demand  # P2 has 0 stock in Borneo
    assert comp_bor.unmet_demand["2"] == 10


def test_intermodal_routes_generated(baseline_scenario: SimulationRequest):
    result = evaluate_reachability(
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
    )

    assert len(result.intermodal_routes) > 0
    p2_route = next(r for r in result.intermodal_routes if r.product_id == "2")
    assert p2_route.departure_port_name == "Penang Logistics Dep"
    assert p2_route.arrival_port_name == "Kuching Transshipment"
    assert p2_route.target_store_name == "Kuching Central Mall"
    assert p2_route.quantity == 10
    assert p2_route.sea_distance_km == 1510.4
    assert "[INFO: INTERMODAL REQUIRED]" in p2_route.token_text
    assert len(p2_route.path_coordinates) == 30


def test_gis_network_edges_geometries(baseline_scenario: SimulationRequest):
    result = evaluate_reachability(
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
    )

    land_edges = [e for e in result.edges if e.modality == Modality.LAND]
    sea_edges = [e for e in result.edges if e.modality == Modality.MARITIME]

    assert len(land_edges) == 4
    assert len(sea_edges) == 1

    # Check Highway geometries: North-South expressway has rich curve alignments
    penang_ipoh = next(e for e in land_edges if "Penang" in e.source_name and "Ipoh" in e.target_name)
    assert len(penang_ipoh.path_coordinates) == 87  # Real E1 highway curve geometry

    ipoh_kl = next(e for e in land_edges if "Ipoh" in e.source_name and "Kuala Lumpur" in e.target_name)
    assert len(ipoh_kl.path_coordinates) == 134  # Real E1 highway curve geometry

    kl_shah_alam = next(e for e in land_edges if "Kuala Lumpur" in e.source_name and "Shah Alam" in e.target_name)
    assert len(kl_shah_alam.path_coordinates) == 18  # Real Federal Route 2 curve geometry

    kuching_road = next(e for e in land_edges if "Kuching" in e.source_name and "Central" in e.target_name)
    assert len(kuching_road.path_coordinates) == 10  # Real bypass road geometry

    # Check Maritime shipping lane geometry
    sea_lane = sea_edges[0]
    assert sea_lane.distance_km == 1510.4
    assert sea_lane.modality == Modality.MARITIME
    assert len(sea_lane.path_coordinates) == 30

    # 1. Navigates around Malay Peninsula through Singapore Strait TSS (min latitude <= 1.20N)
    lats = [pt[0] for pt in sea_lane.path_coordinates]
    assert min(lats) <= 1.20

    # 2. Navigates NORTH of Tanjung Datu / Sambas into deep water (max latitude >= 2.40N)
    # Never cuts across the Borneo landmass (lat must stay >= 2.30N while rounding lon 109.0 - 110.2)
    tg_datu_points = [
        pt for pt in sea_lane.path_coordinates
        if 109.0 <= pt[1] <= 110.2
    ]
    assert len(tg_datu_points) >= 3
    for pt in tg_datu_points:
        assert pt[0] >= 2.30  # At least 35 km north of Tanjung Datu tip (2.08N)


def test_reachability_api_endpoint(client: TestClient, baseline_scenario: SimulationRequest):
    response = client.post("/api/v1/reachability", json=baseline_scenario.model_dump())
    assert response.status_code == 200
    data = response.json()
    assert len(data["components"]) == 2
    assert len(data["edges"]) == 5
    assert len(data["intermodal_routes"]) > 0
    assert "[VERIFIED: REACHABILITY PARTITIONED]" in data["summary"]
