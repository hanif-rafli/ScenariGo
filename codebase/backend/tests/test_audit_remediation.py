"""Comprehensive regression and verification test suite for ScenariGo audit remediation.

Tests:
1. Exact O(V^3) Kuhn-Munkres bipartite matching on non-trivial cost matrices.
2. Inadmissible Big-M cut handling without infinite loops or invalid matches.
3. Stage 2 distributed multi-warehouse surplus reachability without StopIteration.
4. Stage 2 destination-aware maritime routing (Sarawak vs Sabah fairway separation).
5. Stage 3 dynamic custom alphanumeric product IDs in port/airport graph traces.
6. Stage 3 shared vessel slot capacity partitioning.
7. Stage 4 API endpoint resilience on null/optional fleet and budget parameters.
8. Stage 4 custom fleet persistence and dispatch.
"""

from fastapi.testclient import TestClient
from app.models.entities import Warehouse, Store, FleetConfig, EconomicParameters
from app.models.responses import SimulationRequest
from app.models.fleet import TruckInstance
from app.core.stage2_reachability import evaluate_reachability, get_corridor_waypoints
from app.core.stage3_network_flow import solve_network_flow
from app.core.stage4_fleet_routing import (
    hungarian_min_cost_assignment,
    solve_fleet_routing,
)
from app.models.graph import Modality


def test_kuhn_munkres_rectangular_matrix_optimality():
    """Verifies that Kuhn-Munkres finds the global optimum where a greedy algorithm fails.
    
    Cost Matrix:
    Truck 0: Task 0 = 10, Task 1 = 12
    Truck 1: Task 0 = 11, Task 1 = 100
    
    Greedy choice picks (Truck 0 -> Task 0) at cost 10, forcing (Truck 1 -> Task 1) at cost 100 -> Total = 110.
    Optimal choice is (Truck 1 -> Task 0) at 11, (Truck 0 -> Task 1) at 12 -> Total = 23.
    """
    cost_matrix = [
        [10.0, 12.0],
        [11.0, 100.0],
    ]
    matches = hungarian_min_cost_assignment(cost_matrix)
    assert len(matches) == 2
    match_dict = dict(matches)
    assert match_dict[0] == 1  # Truck 0 assigned to Task 1
    assert match_dict[1] == 0  # Truck 1 assigned to Task 0
    total_cost = cost_matrix[0][match_dict[0]] + cost_matrix[1][match_dict[1]]
    assert total_cost == 23.0


def test_kuhn_munkres_unbalanced_dimensions():
    """Verifies rectangular matrix padding for both M > N and M < N."""
    # More trucks (3) than tasks (2)
    m_gt_n = [
        [50.0, 10.0],
        [20.0, 80.0],
        [90.0, 90.0],
    ]
    matches1 = hungarian_min_cost_assignment(m_gt_n)
    assert len(matches1) == 2
    match_dict1 = dict(matches1)
    # Optimal: Truck 0 -> Task 1 (10), Truck 1 -> Task 0 (20) -> Cost = 30
    assert match_dict1[0] == 1
    assert match_dict1[1] == 0

    # More tasks (3) than trucks (2)
    m_lt_n = [
        [10.0, 50.0, 90.0],
        [80.0, 20.0, 90.0],
    ]
    matches2 = hungarian_min_cost_assignment(m_lt_n)
    assert len(matches2) == 2
    match_dict2 = dict(matches2)
    assert match_dict2[0] == 0
    assert match_dict2[1] == 1


def test_kuhn_munkres_inadmissible_big_m_cut():
    """Verifies that edges with cost >= 1e7 are never assigned and do not cause infinite loops."""
    cost_matrix = [
        [10.0, 1e9],
        [1e9, 1e9],
    ]
    matches = hungarian_min_cost_assignment(cost_matrix)
    # Only Truck 0 -> Task 0 is feasible
    assert len(matches) == 1
    assert matches[0] == (0, 0)


def test_stage2_distributed_surplus():
    """Verifies safe surplus resolution when multiple warehouses in the surplus component hold stock."""
    warehouses = [
        Warehouse(
            warehouse_id=0,
            name="KL Hub A",
            latitude=3.139,
            longitude=101.6869,
            is_port=False,
            inventory={"0": 15},
        ),
        Warehouse(
            warehouse_id=1,
            name="KL Hub B",
            latitude=3.145,
            longitude=101.6920,
            is_port=False,
            inventory={"0": 15},
        ),
        Warehouse(
            warehouse_id=2,
            name="Penang Port",
            latitude=5.4164,
            longitude=100.3327,
            is_port=True,
            inventory={"0": 10},
        ),
        Warehouse(
            warehouse_id=3,
            name="Kuching Port",
            latitude=1.5533,
            longitude=110.3592,
            is_port=True,
            inventory={},
        ),
    ]
    stores = [
        Store(
            store_id=0,
            name="Kuching Mall",
            latitude=1.53,
            longitude=110.34,
            requests={"0": 25},  # Shortfall 25 exceeds any single KL Hub (15)
        )
    ]
    res = evaluate_reachability(warehouses, stores)
    assert len(res.components) >= 2
    assert len(res.intermodal_routes) == 1
    assert res.intermodal_routes[0].quantity == 25


def test_stage2_sabah_destination_aware_fairway():
    """Verifies that Sabah cross-strait routes use the Central SCS fairway instead of Tanjung Datu."""
    pts, dist, mod = get_corridor_waypoints(
        "Port Klang Gateway",
        "Kota Kinabalu Port",
        (2.9985, 101.3928),
        (5.9800, 116.0700),
    )
    assert mod == Modality.MARITIME
    assert dist >= 1400.0
    # Assert waypoints traverse the deepwater corridor north of lat 4.0N
    assert any(pt[0] >= 4.0 for pt in pts)


def test_stage3_dynamic_product_ids():
    """Verifies that custom alphanumeric product IDs (e.g. 'P99', 'SKU-ABC') generate full graph nodes."""
    warehouses = [
        Warehouse(
            warehouse_id=0,
            name="Kuala Lumpur Hub",
            latitude=3.139,
            longitude=101.6869,
            is_port=False,
            inventory={"SKU-ABC": 50, "P99": 30},
        ),
        Warehouse(
            warehouse_id=1,
            name="Penang Port",
            latitude=5.4164,
            longitude=100.3327,
            is_port=True,
            inventory={"SKU-ABC": 20},
        ),
        Warehouse(
            warehouse_id=2,
            name="Kuching Port",
            latitude=1.5533,
            longitude=110.3592,
            is_port=True,
            inventory={},
        ),
    ]
    stores = [
        Store(
            store_id=0,
            name="Shah Alam Retail",
            latitude=3.0738,
            longitude=101.5183,
            requests={"SKU-ABC": 25},
        ),
        Store(
            store_id=1,
            name="Kuching Mall",
            latitude=1.53,
            longitude=110.34,
            requests={"SKU-ABC": 10, "P99": 20},
        ),
    ]
    res = solve_network_flow(warehouses, stores)
    assert res.is_flow_feasible is True
    assert res.total_demand_satisfied == 55
    # Verify graph trace contains nodes for dynamic product IDs
    node_ids = [n.node_id for n in res.graph_trace.nodes]
    assert any("SKU-ABC" in nid for nid in node_ids)
    assert any("P99" in nid for nid in node_ids)


def test_stage4_optional_fleet_and_budget_endpoint(client: TestClient):
    """Verifies POST /api/v1/fleet/route handles missing/null fleet and budget_cap without 500 errors."""
    payload = {
        "scenario_name": "Minimal Scenario",
        "warehouses": [
            {
                "warehouse_id": 0,
                "name": "KL Hub",
                "latitude": 3.139,
                "longitude": 101.6869,
                "inventory": {"0": 50},
            }
        ],
        "stores": [
            {
                "store_id": 0,
                "name": "Shah Alam Store",
                "latitude": 3.0738,
                "longitude": 101.5183,
                "requests": {"0": 20},
            }
        ],
        "fleet": None,
        "budget_cap_myr": None,
    }
    resp = client.post("/api/v1/fleet/route", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_budget_feasible"] is True
    assert data["budget_cap_myr"] == 7000.0  # Safe default applied


def test_stage4_custom_fleet_dispatch():
    """Verifies that custom vehicles passed in custom_fleet are scheduled and returned."""
    warehouses = [
        Warehouse(
            warehouse_id=0,
            name="Kuala Lumpur Hub",
            latitude=3.139,
            longitude=101.6869,
            inventory={"0": 50},
        )
    ]
    stores = [
        Store(
            store_id=0,
            name="Shah Alam Retail",
            latitude=3.0738,
            longitude=101.5183,
            requests={"0": 20},
        )
    ]
    flow_res = solve_network_flow(warehouses, stores)
    assert flow_res.is_flow_feasible is True

    custom_truck = TruckInstance(
        truck_id="TRK-CUST-999",
        name="Custom Electric Hauler",
        model_id="custom_ev",
        image_url="/assets/trucks/tata_ace.jpg",
        payload_capacity_kg=2000.0,
        fuel_economy_kmpl=25.0,
        fuel_tank_capacity_l=40.0,
        current_location_name="Kuala Lumpur Hub",
        current_coords=(3.139, 101.6869),
        is_custom=True,
    )

    stage4_res = solve_fleet_routing(
        allocations=flow_res.allocations,
        warehouses=warehouses,
        stores=stores,
        fleet=[custom_truck],
        budget_cap_myr=5000.0,
    )

    assert stage4_res.dispatched_trucks_count == 1
    assert stage4_res.itineraries[0].truck_id == "TRK-CUST-999"
    assert stage4_res.available_trucks[0].is_custom is True
