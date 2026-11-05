from fastapi.testclient import TestClient
from app.models.responses import SimulationRequest
from app.core.stage3_network_flow import solve_network_flow
from app.core.stage4_fleet_routing import solve_fleet_routing, get_default_fleet


def test_default_fleet_generation(baseline_scenario: SimulationRequest):
    fleet = get_default_fleet(baseline_scenario.warehouses)
    assert len(fleet) >= 4
    for truck in fleet:
        assert truck.truck_id.startswith("TRK-")
        assert truck.payload_capacity_kg > 0
        assert truck.fuel_economy_kmpl > 0
        assert truck.fuel_tank_capacity_l > 0
        assert truck.image_url.endswith(".jpg")


def test_baseline_fleet_routing_budget_feasible(baseline_scenario: SimulationRequest):
    # 1. Run Stage 3
    flow_res = solve_network_flow(
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
    )
    assert flow_res.is_flow_feasible is True

    # 2. Run Stage 4
    stage4_res = solve_fleet_routing(
        allocations=flow_res.allocations,
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
        budget_cap_myr=7000.0,
        economic_parameters=baseline_scenario.fleet.economic_parameters,
    )

    assert stage4_res.is_budget_feasible is True
    assert stage4_res.dispatched_trucks_count > 0
    assert stage4_res.total_transport_cost_myr > 0
    assert stage4_res.total_transport_cost_myr <= 7000.0
    assert stage4_res.budget_variance_myr >= 0
    assert any("[VERIFIED: BUDGET COMPLIANT]" in t for t in stage4_res.tokens)
    assert stage4_res.graph_trace is not None
    assert stage4_res.graph_trace.graph_type == "BIPARTITE_MIN_COST"
    assert len(stage4_res.graph_trace.nodes) > 0
    assert len(stage4_res.graph_trace.steps) > 1


def test_fleet_routing_overbudget_fails_with_token(baseline_scenario: SimulationRequest):
    flow_res = solve_network_flow(
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
    )

    # Set an unrealistically low budget cap of MYR 100
    stage4_res = solve_fleet_routing(
        allocations=flow_res.allocations,
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
        budget_cap_myr=100.0,
        economic_parameters=baseline_scenario.fleet.economic_parameters,
    )

    assert stage4_res.is_budget_feasible is False
    assert stage4_res.budget_variance_myr < 0
    assert any("[FAIL: OVERBUDGET]" in t for t in stage4_res.tokens)


def test_fleet_api_endpoints(client: TestClient, baseline_scenario: SimulationRequest):
    # Test GET /api/v1/fleet/trucks
    resp_trucks = client.get("/api/v1/fleet/trucks")
    assert resp_trucks.status_code == 200
    trucks_data = resp_trucks.json()
    assert len(trucks_data) >= 4
    assert trucks_data[0]["truck_id"] == "TRK-001"

    # Test POST /api/v1/fleet/route
    resp_route = client.post("/api/v1/fleet/route", json=baseline_scenario.model_dump())
    assert resp_route.status_code == 200
    route_data = resp_route.json()
    assert route_data["is_budget_feasible"] is True
    assert route_data["dispatched_trucks_count"] > 0
    assert len(route_data["itineraries"]) > 0
