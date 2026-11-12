from fastapi.testclient import TestClient

from app.core.stage3_network_flow import solve_network_flow
from app.data.presets import get_deficit_preset
from app.models.flow import RouteType
from app.models.responses import SimulationRequest


def test_baseline_circulation_feasible(baseline_scenario: SimulationRequest):
    result = solve_network_flow(
        warehouses=baseline_scenario.warehouses,
        stores=baseline_scenario.stores,
    )

    assert result.is_flow_feasible is True
    assert result.total_demand_satisfied == 80
    assert result.total_demand_requested == 80
    assert result.satisfaction_rate_pct == 100.0
    assert len(result.allocations) == 6
    assert len(result.bottlenecks) == 0

    # Verify intermodal allocation for Product 2 (Penang -> Kuching)
    p2_alloc = next((a for a in result.allocations if a.product_id == "2"), None)
    assert p2_alloc is not None
    assert p2_alloc.source_name == "Penang Logistics Dep"
    assert p2_alloc.target_name == "Kuching Central Mall"
    assert p2_alloc.quantity == 10
    assert p2_alloc.route_type == RouteType.INTERMODAL_TRANSSHIPMENT
    assert p2_alloc.departure_port_name == "Penang Logistics Dep"
    assert p2_alloc.arrival_port_name == "Kuching Transshipment"
    assert p2_alloc.distance_km == 1510.4

    # Verify highway allocations in Peninsular
    p0_shah_alam = next(
        (a for a in result.allocations if a.product_id == "0" and "Shah Alam" in a.target_name),
        None,
    )
    assert p0_shah_alam is not None
    assert p0_shah_alam.quantity == 25
    assert p0_shah_alam.route_type == RouteType.DIRECT_HIGHWAY

    assert "[VERIFIED: FLOW OPTIMAL]" in result.summary
    assert result.graph_trace is not None
    assert result.graph_trace.graph_type == "CIRCULATION_DEMANDS"
    assert len(result.graph_trace.nodes) > 0
    assert len(result.graph_trace.steps) > 1
    assert result.graph_trace.steps[0].step_index == 0


def test_deficit_circulation_infeasible():
    deficit_scenario = get_deficit_preset()
    result = solve_network_flow(
        warehouses=deficit_scenario.warehouses,
        stores=deficit_scenario.stores,
    )

    assert result.is_flow_feasible is False
    assert result.total_demand_requested == 110
    assert result.total_demand_satisfied == 95
    assert len(result.bottlenecks) > 0
    assert len(result.bottleneck_details) == 1

    b = result.bottleneck_details[0]
    assert b.product_id == "1"
    assert b.store_name == "Kuching Central Mall"
    assert b.requested_units == 50
    assert b.allocated_units == 35
    assert b.shortfall_units == 15
    assert len(b.contributing_warehouses) == 2
    assert "[FAIL: BOTTLENECK TRACE]" in b.root_cause or "Supply Exhaustion" in b.root_cause


def test_flow_api_endpoint(client: TestClient, baseline_scenario: SimulationRequest):
    response = client.post("/api/v1/flow", json=baseline_scenario.model_dump())
    assert response.status_code == 200
    data = response.json()
    assert data["is_flow_feasible"] is True
    assert data["total_demand_satisfied"] == 80
    assert len(data["allocations"]) == 6
    assert len(data["corridor_utilizations"]) > 0
    assert "[VERIFIED: FLOW OPTIMAL]" in data["summary"]
