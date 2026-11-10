from fastapi.testclient import TestClient
from app.main import app
from app.models.graph import Modality
from app.core.stage2_reachability import evaluate_reachability
from app.core.stage3_network_flow import solve_network_flow
from app.core.stage4_fleet_routing import solve_fleet_routing
from app.data.presets import get_air_freight_preset

client = TestClient(app)


def test_get_air_freight_preset_endpoint():
    """Validates the GET /api/v1/presets/air-freight endpoint returns valid preset data."""
    response = client.get("/api/v1/presets/air-freight")
    assert response.status_code == 200
    data = response.json()
    assert "KLIA" in data["scenario_name"]
    assert any(w.get("is_airport") for w in data["warehouses"])
    assert data["budget_cap_myr"] == 9500.0


def test_air_freight_stage2_reachability():
    """Validates that Stage 2 identifies airport hubs and constructs an AIR modality edge."""
    preset = get_air_freight_preset()
    res = evaluate_reachability(preset.warehouses, preset.stores)

    # Check edges have Modality.AIR (value 2)
    air_edges = [e for e in res.edges if e.modality == Modality.AIR]
    assert len(air_edges) > 0
    assert air_edges[0].distance_km == 985.0
    assert air_edges[0].transit_hours == 1.8
    assert len(air_edges[0].path_coordinates) > 0

    # Check intermodal route is AIR
    assert len(res.intermodal_routes) > 0
    air_route = res.intermodal_routes[0]
    assert air_route.modality == Modality.AIR
    assert "AIR FREIGHT" in air_route.token_text
    assert air_route.sea_distance_km == 985.0


def test_air_freight_stage3_network_flow():
    """Validates that Stage 3 executes Edmonds-Karp with AIR_GATEWAY nodes and Modality.AIR allocations."""
    preset = get_air_freight_preset()
    res = solve_network_flow(preset.warehouses, preset.stores)

    assert res.is_flow_feasible is True
    assert res.satisfaction_rate_pct == 100.0

    # Check air allocation exists
    air_allocs = [a for a in res.allocations if a.modality == Modality.AIR]
    assert len(air_allocs) > 0
    assert air_allocs[0].quantity > 0
    assert air_allocs[0].distance_km == 985.0

    # Check graph trace contains AIR_GATEWAY nodes
    assert res.graph_trace is not None
    air_gateway_nodes = [n for n in res.graph_trace.nodes if n.node_type == "AIR_GATEWAY"]
    assert len(air_gateway_nodes) >= 2


def test_air_freight_stage4_fleet_routing_and_budget():
    """Validates that Stage 4 calculates air cargo costs and schedules last-mile airport delivery."""
    preset = get_air_freight_preset()
    flow_res = solve_network_flow(preset.warehouses, preset.stores)
    res = solve_fleet_routing(
        allocations=flow_res.allocations,
        warehouses=preset.warehouses,
        stores=preset.stores,
        budget_cap_myr=preset.budget_cap_myr,
        economic_parameters=preset.fleet.economic_parameters,
    )

    assert res.is_budget_feasible is True
    assert res.total_air_cost_myr > 0
    assert any("[AIR FREIGHT AUDIT]" in t for t in res.tokens)
    assert res.dispatched_trucks_count > 0


def test_airport_highway_corridors_snapped():
    """Validates that land highway paths connect directly to airport nodes with zero gap."""
    preset = get_air_freight_preset()
    res = evaluate_reachability(preset.warehouses, preset.stores)

    wh_by_name = {w.name: w for w in preset.warehouses}
    st_by_name = {s.name: s for s in preset.stores}

    klia_wh = wh_by_name["Kuala Lumpur Hub (KLIA Air Cargo)"]
    kch_wh = wh_by_name["Kuching Air Cargo Hub"]
    sa_st = st_by_name["Shah Alam Retail"]
    kch_st = st_by_name["Kuching Central Mall"]

    # Check KLIA -> Shah Alam highway edge
    klia_sa_edges = [
        e for e in res.edges
        if e.source_name == klia_wh.name and e.target_name == sa_st.name and e.modality == Modality.LAND
    ]
    assert len(klia_sa_edges) == 1
    edge_klia_sa = klia_sa_edges[0]
    assert edge_klia_sa.path_coordinates[0] == (klia_wh.latitude, klia_wh.longitude)
    assert edge_klia_sa.path_coordinates[-1] == (sa_st.latitude, sa_st.longitude)
    assert edge_klia_sa.distance_km == 48.9

    # Check Kuching Airport -> Kuching Mall highway edge
    kch_edges = [
        e for e in res.edges
        if e.source_name == kch_wh.name and e.target_name == kch_st.name and e.modality == Modality.LAND
    ]
    assert len(kch_edges) == 1
    edge_kch = kch_edges[0]
    assert edge_kch.path_coordinates[0] == (kch_wh.latitude, kch_wh.longitude)
    assert edge_kch.path_coordinates[-1] == (kch_st.latitude, kch_st.longitude)
    assert edge_kch.distance_km == 9.3

