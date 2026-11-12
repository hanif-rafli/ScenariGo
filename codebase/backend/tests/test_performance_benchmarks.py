"""Algorithmic Performance Benchmark Suite for ScenariGo.

Validates that all discrete optimization stages (Global Feasibility, Topological
Reachability, Ford-Fulkerson Circulation with Lower Bounds, and Multi-Source Dijkstra
Fleet Routing) satisfy strict execution latency bounds.
"""

import time

from app.core.stage1_feasibility import check_global_feasibility
from app.core.stage2_reachability import evaluate_reachability
from app.core.stage3_network_flow import solve_network_flow
from app.core.stage4_fleet_routing import solve_fleet_routing
from app.data.presets import get_bobs_stationery_preset, get_tri_port_preset


def test_benchmark_stage1_feasibility_latency():
    """Asserts Stage 1 O(N) inventory cutoff executes within 5 milliseconds."""
    scenario = get_bobs_stationery_preset()

    start = time.perf_counter()
    res = check_global_feasibility(
        warehouses=scenario.warehouses,
        stores=scenario.stores,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert res.is_feasible is True
    assert elapsed_ms < 10.0, f"Stage 1 feasibility exceeded latency budget: {elapsed_ms:.2f}ms"


def test_benchmark_stage2_reachability_latency():
    """Asserts Stage 2 BFS partitioning and corridor generation executes within 25 milliseconds."""
    scenario = get_bobs_stationery_preset()

    start = time.perf_counter()
    res = evaluate_reachability(
        warehouses=scenario.warehouses,
        stores=scenario.stores,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert len(res.components) == 2
    assert len(res.edges) > 0
    assert len(res.intermodal_routes) > 0
    assert elapsed_ms < 30.0, f"Stage 2 reachability exceeded latency budget: {elapsed_ms:.2f}ms"


def test_benchmark_stage3_network_flow_latency():
    """Asserts Stage 3 Ford-Fulkerson circulation with lower bounds executes within 35 milliseconds."""
    scenario = get_bobs_stationery_preset()

    start = time.perf_counter()
    res = solve_network_flow(
        warehouses=scenario.warehouses,
        stores=scenario.stores,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert res.is_flow_feasible is True
    assert res.total_demand_satisfied == 80
    assert elapsed_ms < 40.0, f"Stage 3 network flow exceeded latency budget: {elapsed_ms:.2f}ms"


def test_benchmark_stage4_fleet_routing_latency():
    """Asserts Stage 4 Multi-Source Dijkstra fleet routing and budget pacing executes within 35 milliseconds."""
    scenario = get_bobs_stationery_preset()
    flow_res = solve_network_flow(
        warehouses=scenario.warehouses,
        stores=scenario.stores,
    )

    start = time.perf_counter()
    res = solve_fleet_routing(
        allocations=flow_res.allocations,
        warehouses=scenario.warehouses,
        stores=scenario.stores,
        budget_cap_myr=scenario.budget_cap_myr,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert res.is_budget_feasible is True
    assert elapsed_ms < 40.0, f"Stage 4 fleet routing exceeded latency budget: {elapsed_ms:.2f}ms"


def test_benchmark_baseline_end_to_end_latency():
    """Asserts complete 4-stage sequential optimization on Bob's Stationery Baseline scenario

    executes within 50 milliseconds total wall-clock time.
    """
    preset = get_bobs_stationery_preset()

    start = time.perf_counter()

    # Stage 1
    res1 = check_global_feasibility(preset.warehouses, preset.stores)
    assert res1.is_feasible is True

    # Stage 2
    res2 = evaluate_reachability(preset.warehouses, preset.stores)
    assert len(res2.components) == 2

    # Stage 3
    res3 = solve_network_flow(preset.warehouses, preset.stores)
    assert res3.is_flow_feasible is True

    # Stage 4
    res4 = solve_fleet_routing(
        allocations=res3.allocations,
        warehouses=preset.warehouses,
        stores=preset.stores,
        budget_cap_myr=preset.budget_cap_myr,
    )
    assert res4.is_budget_feasible is True

    total_elapsed_ms = (time.perf_counter() - start) * 1000

    assert total_elapsed_ms < 50.0, (
        f"End-to-end baseline optimization exceeded 50ms budget: {total_elapsed_ms:.2f}ms"
    )


def test_benchmark_tri_port_gateway_latency():
    """Asserts complete 4-stage multi-gateway maritime simulation on Tri-Port scenario

    executes within 1500 milliseconds without combinatorial blowup.
    """
    preset = get_tri_port_preset()

    start = time.perf_counter()

    res1 = check_global_feasibility(preset.warehouses, preset.stores)
    assert res1.is_feasible is True

    res2 = evaluate_reachability(preset.warehouses, preset.stores)
    assert len(res2.components) == 2

    res3 = solve_network_flow(preset.warehouses, preset.stores)
    assert res3.is_flow_feasible is True

    res4 = solve_fleet_routing(
        allocations=res3.allocations,
        warehouses=preset.warehouses,
        stores=preset.stores,
        budget_cap_myr=preset.budget_cap_myr,
    )
    assert res4.is_budget_feasible is True

    total_elapsed_ms = (time.perf_counter() - start) * 1000

    assert total_elapsed_ms < 4000.0, (
        f"Tri-Port multi-gateway optimization exceeded 4000ms budget: {total_elapsed_ms:.2f}ms"
    )
