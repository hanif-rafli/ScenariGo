"""Command-Line Interface (CLI) for ScenariGo Discrete Optimization & Simulation Engine.

Provides headless 4-stage pipeline execution ('simulate'), parametric sensitivity
sweeps ('sweep'), and SQLite scenario persistence management ('scenarios') with
POSIX exit codes (0 = feasible, 1 = infeasible/error) for DevOps & OR workflows.
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from typing import Any

from app.core.stage1_feasibility import check_global_feasibility
from app.core.stage2_reachability import evaluate_reachability
from app.core.stage3_network_flow import solve_network_flow
from app.core.stage4_fleet_routing import solve_fleet_routing
from app.data.presets import (
    get_air_freight_preset,
    get_bobs_stationery_preset,
    get_deficit_preset,
    get_tri_port_preset,
)
from app.db.database import (
    activate_scenario,
    get_active_scenario,
    get_scenario,
    list_scenarios,
    reset_preset_scenario,
)
from app.models.entities import EconomicParameters, FleetConfig, get_default_products
from app.models.graph import Modality
from app.models.responses import SimulationRequest

PRESET_ALIASES: dict[str, str] = {
    "bobs-stationery": "bob-stationery",
    "bob": "bob-stationery",
    "baseline": "bob-stationery",
    "deficit": "deficit-sample",
    "air": "air-freight",
    "triport": "tri-port",
}


def _product_name_map(scenario: SimulationRequest) -> dict[str, str]:
    """Builds a lookup map from product_id to human-readable product name."""
    mapping: dict[str, str] = {}
    for p in get_default_products():
        mapping[p.product_id] = p.name
    for p in scenario.products or []:
        mapping[p.product_id] = p.name
    return mapping


def _modality_label(modality: Modality) -> str:
    if modality == Modality.MARITIME:
        return "MARITIME"
    if modality == Modality.AIR:
        return "AIR"
    return "HIGHWAY"


def resolve_scenario(
    scenario_id: str | None = None,
    file_path: str | None = None,
    budget_override: float | None = None,
    fuel_price_override: float | None = None,
) -> SimulationRequest:
    """Resolves a SimulationRequest from file, scenario_id, or active SQLite state."""
    scenario: SimulationRequest | None = None

    if file_path:
        path = Path(file_path)
        if not path.exists():
            raise ValueError(f"Scenario file not found: {file_path}")
        raw_text = path.read_text(encoding="utf-8")
        scenario = SimulationRequest.model_validate_json(raw_text)
    elif scenario_id:
        normalized_id = PRESET_ALIASES.get(scenario_id.lower(), scenario_id)
        scenario = get_scenario(normalized_id)
        if scenario is None:
            preset_factories = {
                "bob-stationery": get_bobs_stationery_preset,
                "deficit-sample": get_deficit_preset,
                "air-freight": get_air_freight_preset,
                "tri-port": get_tri_port_preset,
            }
            if normalized_id in preset_factories:
                scenario = preset_factories[normalized_id]()
            else:
                raise ValueError(
                    f"Scenario '{scenario_id}' not found. Run 'scenarios list' to view valid IDs."
                )
    else:
        scenario = get_active_scenario()

    # Apply overrides on a deep copy
    scenario = scenario.model_copy(deep=True)
    if budget_override is not None:
        scenario.budget_cap_myr = budget_override

    if fuel_price_override is not None:
        if scenario.fleet is None:
            scenario.fleet = FleetConfig(economic_parameters=EconomicParameters())
        scenario.fleet.economic_parameters.fuel_price_myr_per_liter = fuel_price_override

    return scenario


def execute_four_stage_pipeline(scenario: SimulationRequest) -> dict[str, Any]:
    """Executes all 4 discrete optimization stages and records execution telemetry."""
    econ = (
        scenario.fleet.economic_parameters
        if scenario.fleet and scenario.fleet.economic_parameters
        else EconomicParameters()
    )
    budget_cap = (
        scenario.budget_cap_myr
        if scenario.budget_cap_myr is not None
        else econ.default_budget_cap_myr
    )

    t0 = time.perf_counter()
    s1 = check_global_feasibility(warehouses=scenario.warehouses, stores=scenario.stores)
    t1 = time.perf_counter()

    s2 = evaluate_reachability(
        warehouses=scenario.warehouses,
        stores=scenario.stores,
    )
    t2 = time.perf_counter()

    s3 = solve_network_flow(
        warehouses=scenario.warehouses,
        stores=scenario.stores,
    )
    t3 = time.perf_counter()

    s4 = solve_fleet_routing(
        allocations=s3.allocations,
        warehouses=scenario.warehouses,
        stores=scenario.stores,
        fleet=scenario.custom_fleet,
        budget_cap_myr=budget_cap,
        economic_parameters=econ,
        products=scenario.products,
    )
    t4 = time.perf_counter()

    has_range_failure = any(itin.is_range_exceeded for itin in s4.itineraries)
    is_overall_feasible = (
        s1.is_feasible and s3.is_flow_feasible and s4.is_budget_feasible and not has_range_failure
    )

    return {
        "scenario": scenario,
        "stage1": s1,
        "stage2": s2,
        "stage3": s3,
        "stage4": s4,
        "is_overall_feasible": is_overall_feasible,
        "timing_ms": {
            "stage1_ms": round((t1 - t0) * 1000, 2),
            "stage2_ms": round((t2 - t1) * 1000, 2),
            "stage3_ms": round((t3 - t2) * 1000, 2),
            "stage4_ms": round((t4 - t3) * 1000, 2),
            "total_ms": round((t4 - t0) * 1000, 2),
        },
    }


def _export_allocations_csv(csv_path: str, bundle: dict[str, Any]) -> None:
    """Exports Stage 3 commodity allocations and Stage 4 truck assignments to CSV."""
    scenario: SimulationRequest = bundle["scenario"]
    s3 = bundle["stage3"]
    s4 = bundle["stage4"]
    p_names = _product_name_map(scenario)
    itin_by_alloc = {it.allocation_id: it for it in s4.itineraries}

    out_file = Path(csv_path)
    with out_file.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "allocation_id",
                "product_name",
                "quantity_units",
                "source_warehouse",
                "target_store",
                "modality",
                "distance_km",
                "transit_hours",
                "assigned_truck_id",
                "assigned_truck_name",
                "fuel_cost_myr",
                "status",
            ]
        )
        for alloc in s3.allocations:
            itin = itin_by_alloc.get(alloc.allocation_id)
            writer.writerow(
                [
                    alloc.allocation_id,
                    p_names.get(alloc.product_id, f"Product {alloc.product_id}"),
                    alloc.quantity,
                    alloc.source_name,
                    alloc.target_name,
                    _modality_label(alloc.modality),
                    f"{alloc.distance_km:.1f}",
                    f"{alloc.transit_hours:.2f}",
                    itin.truck_id if itin else "INTERMODAL_CARRIER",
                    itin.truck_name if itin else "Vessel / Air Freight",
                    f"{itin.total_fuel_cost_myr:.2f}" if itin else "0.00",
                    alloc.status.value,
                ]
            )


def print_simulation_report(bundle: dict[str, Any]) -> None:
    """Prints a structured, monochrome ASCII report of the 4-stage pipeline results."""
    scenario: SimulationRequest = bundle["scenario"]
    s1 = bundle["stage1"]
    s2 = bundle["stage2"]
    s3 = bundle["stage3"]
    s4 = bundle["stage4"]
    timing = bundle["timing_ms"]
    is_ok = bundle["is_overall_feasible"]
    p_names = _product_name_map(scenario)

    line = "=" * 92
    subline = "-" * 92
    overall_badge = "[VERIFIED: FEASIBLE]" if is_ok else "[FAIL: INFEASIBLE]"

    print(line)
    print(f"SCENARIGO DISCRETE OPTIMIZATION ENGINE  |  {overall_badge}")
    print(subline)
    print(
        f"Scenario : {scenario.scenario_name} ({scenario.scenario_id or 'custom'})"
        f"  |  Warehouses: {len(scenario.warehouses)}  |  Stores: {len(scenario.stores)}"
    )
    print(
        f"Runtime  : {timing['total_ms']:.2f} ms "
        f"(S1: {timing['stage1_ms']:.2f}ms, S2: {timing['stage2_ms']:.2f}ms, "
        f"S3: {timing['stage3_ms']:.2f}ms, S4: {timing['stage4_ms']:.2f}ms)"
    )
    print(line)

    # STAGE 1
    s1_badge = "[OK]" if s1.is_feasible else "[FAIL: INVENTORY DEFICIT]"
    print(f"\n1. STAGE 1: GLOBAL INVENTORY FEASIBILITY  {s1_badge}")
    print(subline)
    print(f"{'Product Name':<36} | {'Requested':>10} | {'Available':>10} | {'Deficit':>8} | Status")
    print(subline)
    for tok in s1.tokens:
        pname = p_names.get(tok.product_id, f"Product {tok.product_id}")
        status_str = "[OK]" if tok.deficit == 0 else f"[{tok.status.value}]"
        print(
            f"{pname[:36]:<36} | {tok.requested:>10} | {tok.available:>10} | "
            f"{tok.deficit:>8} | {status_str}"
        )

    # STAGE 2
    print(
        f"\n2. STAGE 2: TOPOLOGICAL REACHABILITY & SUBGRAPH PARTITIONING  "
        f"[{len(s2.components)} Components, {len(s2.intermodal_routes)} Intermodal Gateways]"
    )
    print(subline)
    for comp in s2.components:
        suff = "[SELF-SUFFICIENT]" if comp.is_self_sufficient else "[REQUIRES TRANSSHIPMENT]"
        print(
            f"  * {comp.name:<42} | Warehouses: {len(comp.warehouse_ids)} | "
            f"Stores: {len(comp.store_ids)} | {suff}"
        )
    if s2.intermodal_routes:
        print("  Intermodal Corridors:")
        for route in s2.intermodal_routes:
            pname = p_names.get(route.product_id, f"Product {route.product_id}")
            mod_str = _modality_label(route.modality)
            print(
                f"    [{mod_str}] {route.departure_port_name} -> {route.arrival_port_name} "
                f"({route.Target_store_name if hasattr(route, 'Target_store_name') else route.target_store_name}): "
                f"{route.quantity} units {pname} ({route.sea_distance_km:.1f} km, "
                f"MYR {route.estimated_carrier_cost_myr:,.2f})"
            )

    # STAGE 3
    s3_badge = (
        f"[OK: {s3.satisfaction_rate_pct:.1f}% FULFILLED]"
        if s3.is_flow_feasible
        else f"[FAIL: DEFICIT ({s3.satisfaction_rate_pct:.1f}% FULFILLED)]"
    )
    print(f"\n3. STAGE 3: MULTI-COMMODITY NETWORK FLOW (CIRCULATION)  {s3_badge}")
    print(subline)
    if s3.allocations:
        print(
            f"{'Source Warehouse':<26} | {'Target Store':<24} | "
            f"{'Product Name':<24} | {'Qty':>4} | {'Modality':<8}"
        )
        print(subline)
        for alloc in s3.allocations:
            pname = p_names.get(alloc.product_id, f"Product {alloc.product_id}")
            print(
                f"{alloc.source_name[:26]:<26} | {alloc.target_name[:24]:<24} | "
                f"{pname[:24]:<24} | {alloc.quantity:>4} | {_modality_label(alloc.modality):<8}"
            )
    if s3.bottleneck_details:
        print("\n  Causal Bottleneck Attributions:")
        for b in s3.bottleneck_details:
            pname = p_names.get(b.product_id, f"Product {b.product_id}")
            print(
                f"    [DEFICIT] {b.store_name} | {pname}: "
                f"{b.requested_units} requested - {b.allocated_units} delivered = "
                f"{b.shortfall_units} shortfall ({b.root_cause})"
            )

    # STAGE 4
    s4_badge = "[VERIFIED: WITHIN BUDGET]" if s4.is_budget_feasible else "[FAIL: OVERBUDGET]"
    print(f"\n4. STAGE 4: FLEET ROUTING, RANGE PACING & BUDGET  {s4_badge}")
    print(subline)
    if s4.itineraries:
        print(
            f"{'Truck':<22} | {'Route (Origin -> Store)':<36} | "
            f"{'Dist (km)':>9} | {'Fuel (L)':>8} | {'Cost (MYR)':>10}"
        )
        print(subline)
        for it in s4.itineraries:
            route_str = f"{it.source_warehouse_name[:16]} -> {it.target_store_name[:16]}"
            refuel_tag = f" [+{len(it.refueling_stops)} R&R]" if it.is_refueled else ""
            print(
                f"{(it.truck_id + ' ' + it.truck_name)[:22]:<22} | "
                f"{(route_str + refuel_tag)[:36]:<36} | "
                f"{it.total_distance_km:>9.1f} | {it.total_fuel_liters:>8.2f} | "
                f"{it.total_fuel_cost_myr:>10.2f}"
            )

    variance_label = (
        f"MYR {s4.budget_variance_myr:,.2f} surplus"
        if s4.budget_variance_myr >= 0
        else f"MYR {abs(s4.budget_variance_myr):,.2f} OVERAGE"
    )
    print(subline)
    print(
        f"Cost Breakdown : Fleet Fuel MYR {s4.total_fleet_fuel_cost_myr:,.2f}  |  "
        f"Maritime MYR {s4.total_maritime_cost_myr:,.2f}  |  "
        f"Air MYR {s4.total_air_cost_myr:,.2f}"
    )
    print(
        f"Total Cost     : MYR {s4.total_transport_cost_myr:,.2f} / "
        f"Cap MYR {s4.budget_cap_myr:,.2f} ({variance_label})"
    )
    print(line)


def handle_simulate(args: argparse.Namespace) -> int:
    """Handler for 'simulate' subcommand."""
    try:
        scenario = resolve_scenario(
            scenario_id=args.scenario,
            file_path=args.file,
            budget_override=args.budget,
            fuel_price_override=args.fuel_price,
        )
    except ValueError as err:
        print(f"[ERROR] {err}", file=sys.stderr)
        return 1

    bundle = execute_four_stage_pipeline(scenario)

    if args.export_csv:
        _export_allocations_csv(args.export_csv, bundle)

    if args.json:
        s3_dump = bundle["stage3"].model_dump(exclude={"graph_trace"})
        for alloc in s3_dump.get("allocations", []):
            alloc.pop("path_coordinates", None)

        s4_dump = bundle["stage4"].model_dump(exclude={"graph_trace"})
        for itin in s4_dump.get("itineraries", []):
            for leg in itin.get("legs", []):
                leg.pop("path_coordinates", None)

        payload = {
            "scenario_id": scenario.scenario_id,
            "scenario_name": scenario.scenario_name,
            "is_overall_feasible": bundle["is_overall_feasible"],
            "timing_ms": bundle["timing_ms"],
            "stage1": bundle["stage1"].model_dump(),
            "stage2": bundle["stage2"].model_dump(exclude={"edges"}),
            "stage3": s3_dump,
            "stage4": s4_dump,
        }
        print(json.dumps(payload, indent=2))
    else:
        print_simulation_report(bundle)
        if args.export_csv:
            print(f"[EXPORTED] Allocation & dispatch manifest saved to: {args.export_csv}")

    return 0 if bundle["is_overall_feasible"] else 1


def handle_sweep(args: argparse.Namespace) -> int:
    """Handler for 'sweep' parametric sensitivity analysis subcommand."""
    if args.step <= 0:
        print("[ERROR] --step must be greater than 0.", file=sys.stderr)
        return 1
    if args.max < args.min:
        print("[ERROR] --max must be greater than or equal to --min.", file=sys.stderr)
        return 1

    try:
        base_scenario = resolve_scenario(scenario_id=args.scenario, file_path=args.file)
    except ValueError as err:
        print(f"[ERROR] {err}", file=sys.stderr)
        return 1

    steps: list[float] = []
    curr = args.min
    while curr <= args.max + 1e-9:
        steps.append(round(curr, 4))
        curr += args.step

    results: list[dict[str, Any]] = []
    for val in steps:
        scen_copy = base_scenario.model_copy(deep=True)
        if scen_copy.fleet is None:
            scen_copy.fleet = FleetConfig(economic_parameters=EconomicParameters())

        if args.param == "budget":
            scen_copy.budget_cap_myr = val
        elif args.param == "fuel_price":
            scen_copy.fleet.economic_parameters.fuel_price_myr_per_liter = val
        elif args.param == "sea_rate":
            scen_copy.fleet.economic_parameters.intermodal_sea_per_kg_myr = val
        elif args.param == "air_rate":
            scen_copy.fleet.economic_parameters.intermodal_air_per_kg_myr = val

        bundle = execute_four_stage_pipeline(scen_copy)
        s3 = bundle["stage3"]
        s4 = bundle["stage4"]
        results.append(
            {
                "param": args.param,
                "value": val,
                "fulfillment_pct": s3.satisfaction_rate_pct,
                "fleet_fuel_cost_myr": s4.total_fleet_fuel_cost_myr,
                "intermodal_cost_myr": round(s4.total_maritime_cost_myr + s4.total_air_cost_myr, 2),
                "total_cost_myr": s4.total_transport_cost_myr,
                "budget_cap_myr": s4.budget_cap_myr,
                "budget_variance_myr": s4.budget_variance_myr,
                "is_feasible": bundle["is_overall_feasible"],
                "status": "[VERIFIED]" if bundle["is_overall_feasible"] else "[FAIL]",
            }
        )

    if args.json:
        print(
            json.dumps(
                {
                    "scenario_id": base_scenario.scenario_id,
                    "scenario_name": base_scenario.scenario_name,
                    "parameter": args.param,
                    "sweep_results": results,
                },
                indent=2,
            )
        )
        return 0

    line = "=" * 94
    subline = "-" * 94
    print(line)
    print(
        f"PARAMETRIC SENSITIVITY SWEEP  |  Scenario: {base_scenario.scenario_name}  |  "
        f"Parameter: {args.param}"
    )
    print(subline)
    print(
        f"{'Param Value':>12} | {'Fulfill %':>9} | {'Fuel (MYR)':>11} | "
        f"{'Sea/Air (MYR)':>13} | {'Total (MYR)':>11} | {'Variance (MYR)':>14} | Status"
    )
    print(subline)
    for row in results:
        print(
            f"{row['value']:>12.2f} | {row['fulfillment_pct']:>8.1f}% | "
            f"{row['fleet_fuel_cost_myr']:>11.2f} | {row['intermodal_cost_myr']:>13.2f} | "
            f"{row['total_cost_myr']:>11.2f} | {row['budget_variance_myr']:>+14.2f} | {row['status']}"
        )
    print(line)
    return 0


def handle_scenarios(args: argparse.Namespace) -> int:
    """Handler for 'scenarios' database management subcommand."""
    action = args.scenarios_action

    if action == "list":
        summaries = list_scenarios()
        if args.json:
            print(json.dumps([s.model_dump() for s in summaries], indent=2))
            return 0

        line = "=" * 96
        subline = "-" * 96
        print(line)
        print(
            f"{'Scenario ID':<18} | {'Scenario Name':<42} | {'Type':<8} | "
            f"{'WH':>3} | {'ST':>3} | {'Budget (MYR)':>12} | Active"
        )
        print(subline)
        for s in summaries:
            kind = (
                "PRESET*"
                if (s.is_preset and s.is_modified)
                else ("PRESET" if s.is_preset else "CUSTOM")
            )
            act = "[ACTIVE]" if s.is_active else ""
            print(
                f"{s.scenario_id[:18]:<18} | {s.scenario_name[:42]:<42} | {kind:<8} | "
                f"{s.warehouse_count:>3} | {s.store_count:>3} | {s.budget_cap_myr:>12,.2f} | {act}"
            )
        print(line)
        return 0

    if action == "show":
        try:
            scen = resolve_scenario(scenario_id=args.scenario_id)
        except ValueError as err:
            print(f"[ERROR] {err}", file=sys.stderr)
            return 1

        if args.json:
            print(json.dumps(scen.model_dump(), indent=2))
            return 0

        p_names = _product_name_map(scen)
        print("=" * 84)
        print(f"SCENARIO DETAILS: {scen.scenario_name} ({scen.scenario_id})")
        print("-" * 84)
        print(f"Budget Cap : MYR {(scen.budget_cap_myr or 7000.0):,.2f}")
        print("\nWarehouses:")
        for w in scen.warehouses:
            inv_str = ", ".join(
                f"{p_names.get(pid, pid)}: {qty}" for pid, qty in w.inventory.items()
            )
            tags = []
            if w.is_port:
                tags.append("PORT")
            if w.is_airport:
                tags.append("AIRPORT")
            tag_str = f" [{', '.join(tags)}]" if tags else ""
            print(f"  - {w.name}{tag_str} ({w.latitude:.4f}, {w.longitude:.4f}) -> {inv_str}")

        print("\nRetail Stores:")
        for st in scen.stores:
            req_str = ", ".join(
                f"{p_names.get(pid, pid)}: {qty}" for pid, qty in st.requests.items()
            )
            print(f"  - {st.name} ({st.latitude:.4f}, {st.longitude:.4f}) -> {req_str}")
        print("=" * 84)
        return 0

    if action == "activate":
        norm_id = PRESET_ALIASES.get(args.scenario_id.lower(), args.scenario_id)
        try:
            scen = activate_scenario(norm_id)
            print(f"[OK] Activated scenario: {scen.scenario_name} ({scen.scenario_id})")
            return 0
        except ValueError as err:
            print(f"[ERROR] {err}", file=sys.stderr)
            return 1

    if action == "reset":
        norm_id = PRESET_ALIASES.get(args.scenario_id.lower(), args.scenario_id)
        try:
            scen = reset_preset_scenario(norm_id)
            print(
                f"[OK] Reset factory preset to baseline: {scen.scenario_name} ({scen.scenario_id})"
            )
            return 0
        except ValueError as err:
            print(f"[ERROR] {err}", file=sys.stderr)
            return 1

    return 1


def build_parser() -> argparse.ArgumentParser:
    """Constructs the root argument parser and subcommands for ScenariGo CLI."""
    parser = argparse.ArgumentParser(
        prog="scenarigo",
        description="ScenariGo — Multi-Modal Logistics & Discrete Optimization CLI Engine",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # 1. simulate
    sim_parser = subparsers.add_parser(
        "simulate",
        help="Execute the 4-stage optimization pipeline (exits 0 if feasible, 1 if infeasible)",
    )
    sim_parser.add_argument(
        "-s",
        "--scenario",
        type=str,
        default=None,
        help="Scenario ID (e.g. bob-stationery, deficit-sample, air-freight, tri-port)",
    )
    sim_parser.add_argument(
        "-f",
        "--file",
        type=str,
        default=None,
        help="Path to a custom SimulationRequest JSON file",
    )
    sim_parser.add_argument(
        "--budget",
        type=float,
        default=None,
        help="Override transport budget cap in MYR",
    )
    sim_parser.add_argument(
        "--fuel-price",
        type=float,
        default=None,
        help="Override diesel fuel price in MYR per liter",
    )
    sim_parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON output to stdout",
    )
    sim_parser.add_argument(
        "--export-csv",
        type=str,
        default=None,
        help="Export Stage 3 allocations and Stage 4 truck dispatches to a CSV file",
    )

    # 2. sweep
    sweep_parser = subparsers.add_parser(
        "sweep",
        help="Run parametric sensitivity analysis across budget, fuel_price, sea_rate, or air_rate",
    )
    sweep_parser.add_argument(
        "-s",
        "--scenario",
        type=str,
        default=None,
        help="Scenario ID to sweep (defaults to active scenario)",
    )
    sweep_parser.add_argument(
        "-f",
        "--file",
        type=str,
        default=None,
        help="Path to a custom SimulationRequest JSON file",
    )
    sweep_parser.add_argument(
        "--param",
        choices=["budget", "fuel_price", "sea_rate", "air_rate"],
        default="budget",
        help="Economic parameter to sweep",
    )
    sweep_parser.add_argument("--min", type=float, required=True, help="Minimum parameter value")
    sweep_parser.add_argument("--max", type=float, required=True, help="Maximum parameter value")
    sweep_parser.add_argument("--step", type=float, required=True, help="Step increment")
    sweep_parser.add_argument(
        "--json",
        action="store_true",
        help="Emit sensitivity sweep results as JSON",
    )

    # 3. scenarios
    scen_parser = subparsers.add_parser(
        "scenarios",
        help="Inspect and manage saved SQLite scenarios and factory presets",
    )
    scen_sub = scen_parser.add_subparsers(dest="scenarios_action", required=True)

    list_p = scen_sub.add_parser("list", help="List all scenarios in SQLite database")
    list_p.add_argument("--json", action="store_true", help="Output scenario list as JSON")

    show_p = scen_sub.add_parser("show", help="Show detailed warehouses and stores for a scenario")
    show_p.add_argument("scenario_id", type=str, help="Scenario ID to inspect")
    show_p.add_argument("--json", action="store_true", help="Output scenario payload as JSON")

    act_p = scen_sub.add_parser("activate", help="Set a scenario as active in SQLite")
    act_p.add_argument("scenario_id", type=str, help="Scenario ID to activate")

    rst_p = scen_sub.add_parser("reset", help="Reset a factory preset back to baseline state")
    rst_p.add_argument("scenario_id", type=str, help="Preset scenario ID to reset")

    return parser


def main(argv: list[str] | None = None) -> int:
    """Main CLI entry point returning a POSIX exit code."""
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "simulate":
        return handle_simulate(args)
    if args.command == "sweep":
        return handle_sweep(args)
    if args.command == "scenarios":
        return handle_scenarios(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
