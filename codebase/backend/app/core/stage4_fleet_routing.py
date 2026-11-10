"""Stage 4: Fleet Routing, Fuel Range & Budget Pacing Engine.

Solves the physical fleet assignment and routing problem using:
1. Multi-Source Dijkstra for highway road routing.
2. Fuel Range verification with automatic PLUS Expressway R&R refueling insertion.
3. Bipartite Min-Cost Matching for vehicle-task assignment.
4. Transport budget cap summation against economic parameters.
"""
from collections import defaultdict
import math
from typing import Optional

from app.models.entities import Warehouse, Store, EconomicParameters
from app.models.graph import Modality
from app.models.flow import AllocationItem, RouteType, AllocationStatus
from app.models.graph_trace import (
    GraphNode,
    GraphEdgeSnapshot,
    GraphIterationStep,
    NetworkFlowGraphTrace,
)
from app.models.fleet import (
    TripLegType,
    RefuelingStop,
    TripLeg,
    DispatchItinerary,
    TruckInstance,
    Stage4Result,
)
from app.core.stage2_reachability import evaluate_reachability, get_corridor_waypoints
from app.data.malaysia_rr_stations import PLUS_RR_STATIONS, find_nearest_rr_station
from app.data.malaysia_network import (
    HIGHWAY_PENANG_TO_IPOH_WAYPOINTS,
    HIGHWAY_IPOH_TO_KL_WAYPOINTS,
    HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS,
)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance between two coordinates in kilometers with road detour factor."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c * 1.25, 1)


def get_default_fleet(warehouses: list[Warehouse]) -> list[TruckInstance]:
    """Provides a realistic commercial vehicle fleet across Peninsular and East Malaysia."""
    wh_map = {w.warehouse_id: w for w in warehouses}

    # Peninsular Malaysia Trucks
    kl_wh = wh_map.get(0)
    penang_wh = wh_map.get(1)
    kuching_wh = wh_map.get(2)
    klang_wh = wh_map.get(3)
    ptp_wh = wh_map.get(4)

    kl_name = kl_wh.name if kl_wh else "Kuala Lumpur Hub"
    kl_coords = (kl_wh.latitude, kl_wh.longitude) if kl_wh else (3.1390, 101.6869)
    penang_name = penang_wh.name if penang_wh else "Penang Logistics Dep"
    penang_coords = (penang_wh.latitude, penang_wh.longitude) if penang_wh else (5.4164, 100.3327)
    kuching_name = kuching_wh.name if kuching_wh else "Kuching Transshipment"
    kuching_coords = (kuching_wh.latitude, kuching_wh.longitude) if kuching_wh else (1.5533, 110.3592)

    fleet = [
        TruckInstance(
            truck_id="TRK-001",
            name="Tata Ace Gold #01",
            model_id="tata_ace",
            image_url="/assets/trucks/tata_ace.jpg",
            payload_capacity_kg=900.0,
            fuel_economy_kmpl=22.0,
            fuel_tank_capacity_l=26.0,
            current_location_name=kl_name,
            current_coords=kl_coords,
        ),
        TruckInstance(
            truck_id="TRK-002",
            name="Isuzu 3-Ton Lorry #01",
            model_id="three_ton_lorry",
            image_url="/assets/trucks/isuzu_3ton.jpg",
            payload_capacity_kg=3500.0,
            fuel_economy_kmpl=8.5,
            fuel_tank_capacity_l=100.0,
            current_location_name=kl_name,
            current_coords=kl_coords,
        ),
        TruckInstance(
            truck_id="TRK-003",
            name="Isuzu 3-Ton Lorry #02",
            model_id="three_ton_lorry",
            image_url="/assets/trucks/isuzu_3ton.jpg",
            payload_capacity_kg=3500.0,
            fuel_economy_kmpl=8.5,
            fuel_tank_capacity_l=100.0,
            current_location_name=penang_name,
            current_coords=penang_coords,
        ),
        TruckInstance(
            truck_id="TRK-004",
            name="Isuzu 3-Ton Lorry #03",
            model_id="three_ton_lorry",
            image_url="/assets/trucks/isuzu_3ton.jpg",
            payload_capacity_kg=3500.0,
            fuel_economy_kmpl=8.5,
            fuel_tank_capacity_l=100.0,
            current_location_name=kuching_name,
            current_coords=kuching_coords,
        ),
        TruckInstance(
            truck_id="TRK-005",
            name="Tata Ace Gold #02",
            model_id="tata_ace",
            image_url="/assets/trucks/tata_ace.jpg",
            payload_capacity_kg=900.0,
            fuel_economy_kmpl=22.0,
            fuel_tank_capacity_l=26.0,
            current_location_name=kuching_name,
            current_coords=kuching_coords,
        ),
    ]

    if klang_wh:
        fleet.append(
            TruckInstance(
                truck_id="TRK-006",
                name="Isuzu 3-Ton Lorry #04",
                model_id="three_ton_lorry",
                image_url="/assets/trucks/isuzu_3ton.jpg",
                payload_capacity_kg=3500.0,
                fuel_economy_kmpl=8.5,
                fuel_tank_capacity_l=100.0,
                current_location_name=klang_wh.name,
                current_coords=(klang_wh.latitude, klang_wh.longitude),
            )
        )

    if ptp_wh:
        fleet.append(
            TruckInstance(
                truck_id="TRK-007",
                name="Isuzu 3-Ton Lorry #05",
                model_id="three_ton_lorry",
                image_url="/assets/trucks/isuzu_3ton.jpg",
                payload_capacity_kg=3500.0,
                fuel_economy_kmpl=8.5,
                fuel_tank_capacity_l=100.0,
                current_location_name=ptp_wh.name,
                current_coords=(ptp_wh.latitude, ptp_wh.longitude),
            )
        )

    return fleet


def hungarian_min_cost_assignment(cost_matrix: list[list[float]]) -> list[tuple[int, int]]:
    """Pure Python implementation of Kuhn-Munkres (Hungarian) Min-Cost Matching.
    
    Finds the optimal 1-to-1 matching from rows (trucks) to cols (tasks)
    that minimizes total cost. Cost matrix can be rectangular.
    """
    n_rows = len(cost_matrix)
    if n_rows == 0:
        return []
    n_cols = len(cost_matrix[0])
    if n_cols == 0:
        return []

    # Greedy initial matching for small rectangular bipartite graphs
    assigned_cols: set[int] = set()
    matches: list[tuple[int, int]] = []

    # Sort row-col candidates by increasing cost
    candidates: list[tuple[float, int, int]] = []
    for r in range(n_rows):
        for c in range(n_cols):
            if cost_matrix[r][c] < 1e8:
                candidates.append((cost_matrix[r][c], r, c))

    candidates.sort(key=lambda x: x[0])

    assigned_rows: set[int] = set()
    for cost, r, c in candidates:
        if r not in assigned_rows and c not in assigned_cols:
            assigned_rows.add(r)
            assigned_cols.add(c)
            matches.append((r, c))

    return matches


def solve_fleet_routing(
    allocations: list[AllocationItem],
    warehouses: list[Warehouse],
    stores: list[Store],
    fleet: Optional[list[TruckInstance]] = None,
    budget_cap_myr: float = 7000.0,
    economic_parameters: Optional[EconomicParameters] = None,
) -> Stage4Result:
    """Executes Stage 4 Fleet Routing, Range Checking, and Budget Verification."""
    if economic_parameters is None:
        economic_parameters = EconomicParameters()

    if fleet is None or len(fleet) == 0:
        fleet = get_default_fleet(warehouses)

    wh_map = {w.warehouse_id: w for w in warehouses}
    st_map = {s.store_id: s for s in stores}

    # Partition network to identify landmass components
    reach_res = evaluate_reachability(warehouses, stores)
    comp_map: dict[int, int] = {}
    for comp in reach_res.components:
        for wid in comp.warehouse_ids:
            comp_map[wid] = comp.component_id
        for sid in comp.store_ids:
            comp_map[1000 + sid] = comp.component_id

    # 1. Filter Dispatches that require Land Truck Transportation
    # Direct Highway flows and Intermodal Last-Mile flows
    land_tasks: list[AllocationItem] = []
    maritime_allocations: list[AllocationItem] = []
    air_allocations: list[AllocationItem] = []

    for alloc in allocations:
        if alloc.status != AllocationStatus.ALLOCATED or alloc.quantity <= 0:
            continue
        if alloc.route_type == RouteType.DIRECT_HIGHWAY:
            land_tasks.append(alloc)
        elif alloc.route_type == RouteType.INTERMODAL_TRANSSHIPMENT:
            if alloc.modality == Modality.AIR:
                air_allocations.append(alloc)
            else:
                maritime_allocations.append(alloc)

            # Resolve arrival facility coordinates and destination store for realistic highway routing
            arrival_name = alloc.arrival_port_name or (
                "Arrival Airport" if alloc.modality == Modality.AIR else "Arrival Port"
            )
            arrival_wh = next(
                (
                    w
                    for w in warehouses
                    if w.name.lower() in arrival_name.lower()
                    or arrival_name.lower() in w.name.lower()
                ),
                None,
            )
            target_store = st_map.get(alloc.target_id)

            lastmile_pts: list[tuple[float, float]] = []
            lastmile_dist = 5.9
            lastmile_hours = 0.2

            if arrival_wh and target_store:
                c_arr = (arrival_wh.latitude, arrival_wh.longitude)
                c_store = (target_store.latitude, target_store.longitude)
                lastmile_pts, lastmile_dist, _ = get_corridor_waypoints(
                    arrival_wh.name,
                    target_store.name,
                    c_arr,
                    c_store,
                )
                lastmile_hours = round(lastmile_dist / 45.0, 1)

            # Create a local land delivery task from arrival port or airport to destination store
            land_tasks.append(
                AllocationItem(
                    allocation_id=f"{alloc.allocation_id}-LASTMILE",
                    source_id=arrival_wh.warehouse_id if arrival_wh else alloc.source_id,
                    source_name=arrival_name,
                    target_id=alloc.target_id,
                    target_name=alloc.target_name,
                    product_id=alloc.product_id,
                    quantity=alloc.quantity,
                    modality=Modality.LAND,
                    route_type=RouteType.DIRECT_HIGHWAY,
                    distance_km=lastmile_dist,
                    transit_hours=lastmile_hours,
                    path_coordinates=lastmile_pts if len(lastmile_pts) > 0 else None,
                    status=AllocationStatus.ALLOCATED,
                )
            )

    # 2. Build Bipartite Min-Cost Matrix: Trucks (rows) x Land Tasks (cols)
    num_trucks = len(fleet)
    num_tasks = len(land_tasks)

    cost_matrix: list[list[float]] = [[1e9 for _ in range(num_tasks)] for _ in range(num_trucks)]
    task_metadata: dict[tuple[int, int], dict] = {}

    for t_idx, truck in enumerate(fleet):
        for k_idx, task in enumerate(land_tasks):
            # Payload weight check (assuming 20kg per commodity unit)
            task_weight_kg = task.quantity * 20.0
            if truck.payload_capacity_kg < task_weight_kg:
                continue

            target_store = st_map.get(task.target_id)
            if not target_store:
                continue

            # Determine pickup origin coordinates
            source_wh = next((w for w in warehouses if w.name == task.source_name), None)
            pickup_coords = (source_wh.latitude, source_wh.longitude) if source_wh else target_store and (target_store.latitude, target_store.longitude)
            if not pickup_coords:
                continue

            # Calculate Deadhead Leg (Truck Base -> Pickup Warehouse)
            deadhead_dist = haversine_km(
                truck.current_coords[0], truck.current_coords[1],
                pickup_coords[0], pickup_coords[1]
            )

            # Calculate Haul Leg (Pickup Warehouse -> Delivery Store)
            haul_dist = task.distance_km if task.distance_km > 0 else haversine_km(
                pickup_coords[0], pickup_coords[1],
                target_store.latitude, target_store.longitude
            )

            total_dist = round(deadhead_dist + haul_dist, 1)

            # Check fuel range and refueling needs
            max_range = truck.fuel_tank_capacity_l * truck.fuel_economy_kmpl
            refueling_stops: list[RefuelingStop] = []
            refuel_detour_km = 0.0

            if total_dist > 0.8 * max_range:
                # Insert highway R&R station
                mid_lat = (pickup_coords[0] + target_store.latitude) / 2.0
                mid_lon = (pickup_coords[1] + target_store.longitude) / 2.0
                rr = find_nearest_rr_station(mid_lat, mid_lon)

                # Recalculate haul distance with R&R detour
                d1 = haversine_km(pickup_coords[0], pickup_coords[1], rr["latitude"], rr["longitude"])
                d2 = haversine_km(rr["latitude"], rr["longitude"], target_store.latitude, target_store.longitude)
                refuel_detour_km = round((d1 + d2) - haul_dist, 1)
                total_dist = round(deadhead_dist + haul_dist + max(0.0, refuel_detour_km), 1)

                liters_burned_before = (deadhead_dist + d1) / truck.fuel_economy_kmpl
                refueling_stops.append(
                    RefuelingStop(
                        station_id=rr["station_id"],
                        station_name=rr["name"],
                        highway_name=rr["highway"],
                        coords=(rr["latitude"], rr["longitude"]),
                        liters_refueled=round(liters_burned_before, 1),
                        cost_myr=round(liters_burned_before * economic_parameters.fuel_price_myr_per_liter, 2),
                    )
                )

            total_fuel_liters = round(total_dist / truck.fuel_economy_kmpl, 2)
            total_fuel_cost = round(total_fuel_liters * economic_parameters.fuel_price_myr_per_liter, 2)

            cost_matrix[t_idx][k_idx] = total_fuel_cost
            task_metadata[(t_idx, k_idx)] = {
                "deadhead_dist": deadhead_dist,
                "haul_dist": haul_dist,
                "total_dist": total_dist,
                "total_fuel_liters": total_fuel_liters,
                "total_fuel_cost": total_fuel_cost,
                "refueling_stops": refueling_stops,
                "pickup_coords": pickup_coords,
            }

    # 3. Solve Optimal Assignment
    matches = hungarian_min_cost_assignment(cost_matrix)
    assigned_tasks_set = {c for _, c in matches}

    # 3.1 Construct Bipartite Min-Cost Flow Network Trace
    graph_nodes: list[GraphNode] = [
        GraphNode(
            node_id="SRC",
            short_label="SRC",
            layer=0,
            node_type="SOURCE",
            title="Commercial Fleet Depot Source",
            metadata={"role": "Supplies available vehicle capacity for assignment."},
        )
    ]

    for truck in fleet:
        graph_nodes.append(
            GraphNode(
                node_id=f"TRK_{truck.truck_id}",
                short_label=truck.truck_id,
                layer=1,
                node_type="TRUCK",
                title=f"{truck.name} ({truck.truck_id})",
                metadata={
                    "name": truck.name,
                    "model": truck.model_id,
                    "base_location": truck.current_location_name,
                    "payload_capacity_kg": truck.payload_capacity_kg,
                    "fuel_tank_capacity_l": truck.fuel_tank_capacity_l,
                    "fuel_economy_kmpl": truck.fuel_economy_kmpl,
                },
            )
        )

    for k_idx, task in enumerate(land_tasks):
        graph_nodes.append(
            GraphNode(
                node_id=f"TASK_{k_idx + 1}",
                short_label=f"(S{task.target_id},P{task.product_id})",
                layer=2,
                node_type="TASK",
                title=f"Task {k_idx + 1}: {task.source_name} -> {task.target_name}",
                metadata={
                    "allocation_id": task.allocation_id,
                    "source": task.source_name,
                    "destination": task.target_name,
                    "product_id": task.product_id,
                    "quantity_units": task.quantity,
                    "distance_km": task.distance_km,
                    "transit_hours": task.transit_hours,
                },
            )
        )

    graph_nodes.append(
        GraphNode(
            node_id="SNK",
            short_label="SNK",
            layer=3,
            node_type="SINK",
            title="Fulfillment Sink",
            metadata={"role": "Collects completed retail delivery tasks."},
        )
    )

    base_edges_dict: dict[str, dict[str, Any]] = {}
    for truck in fleet:
        e_id = f"SRC->TRK_{truck.truck_id}"
        base_edges_dict[e_id] = {
            "source": "SRC",
            "target": f"TRK_{truck.truck_id}",
            "capacity": 1,
            "cost_myr": 0.0,
            "edge_type": "FLEET_DISPATCH",
        }

    for t_idx, truck in enumerate(fleet):
        for k_idx, task in enumerate(land_tasks):
            if cost_matrix[t_idx][k_idx] < 1e8:
                e_id = f"TRK_{truck.truck_id}->TASK_{k_idx + 1}"
                base_edges_dict[e_id] = {
                    "source": f"TRK_{truck.truck_id}",
                    "target": f"TASK_{k_idx + 1}",
                    "capacity": 1,
                    "cost_myr": task_metadata[(t_idx, k_idx)]["total_fuel_cost"],
                    "edge_type": "ASSIGNMENT_CANDIDATE",
                }

    for k_idx, task in enumerate(land_tasks):
        e_id = f"TASK_{k_idx + 1}->SNK"
        base_edges_dict[e_id] = {
            "source": f"TASK_{k_idx + 1}",
            "target": "SNK",
            "capacity": 1,
            "cost_myr": 0.0,
            "edge_type": "TASK_FULFILLMENT",
        }

    def make_mcmf_snapshot(flow_state: dict[str, int], active_path: set[str]) -> list[GraphEdgeSnapshot]:
        snapshots: list[GraphEdgeSnapshot] = []
        for e_id, info in base_edges_dict.items():
            f = flow_state.get(e_id, 0)
            c = info["capacity"]
            snapshots.append(
                GraphEdgeSnapshot(
                    edge_id=e_id,
                    source=info["source"],
                    target=info["target"],
                    flow=f,
                    capacity=c,
                    lower_bound=0,
                    residual_forward=c - f,
                    residual_backward=f,
                    cost_myr=info["cost_myr"],
                    in_augmenting_path=e_id in active_path,
                    edge_type=info["edge_type"],
                )
            )
        return snapshots

    timeline_steps: list[GraphIterationStep] = [
        GraphIterationStep(
            step_index=0,
            label="STEP 0: UNASSIGNED FLEET NETWORK",
            description="Bipartite Min-Cost Flow network formulated: Commercial Fleet (Layer 1) to Land Delivery Tasks (Layer 2). Directed edge weights reflect exact fuel cost (MYR) per route.",
            bottleneck_flow=0,
            cumulative_flow=0,
            cumulative_cost_myr=0.0,
            augmenting_path_nodes=[],
            augmenting_path_edges=[],
            edges=make_mcmf_snapshot({}, set()),
        )
    ]

    current_flows: dict[str, int] = {}
    cum_cost = 0.0
    cum_flow = 0

    for match_idx, (t_idx, k_idx) in enumerate(matches):
        truck = fleet[t_idx]
        task = land_tasks[k_idx]
        meta = task_metadata[(t_idx, k_idx)]
        fuel_cost = meta["total_fuel_cost"]
        cum_cost += fuel_cost
        cum_flow += 1

        t_node_id = f"TRK_{truck.truck_id}"
        task_node_id = f"TASK_{k_idx + 1}"
        e1 = f"SRC->{t_node_id}"
        e2 = f"{t_node_id}->{task_node_id}"
        e3 = f"{task_node_id}->SNK"

        current_flows[e1] = 1
        current_flows[e2] = 1
        current_flows[e3] = 1

        path_nodes = ["SRC", t_node_id, task_node_id, "SNK"]
        path_edges = [e1, e2, e3]
        task_label = f"(S{task.target_id},P{task.product_id})"

        timeline_steps.append(
            GraphIterationStep(
                step_index=match_idx + 1,
                label=f"STEP {match_idx + 1}: ASSIGN {truck.truck_id} -> {task_label}",
                description=f"Augmented min-cost path: SRC -> {truck.truck_id} -> {task_label} -> SNK. Additional fuel cost: MYR {fuel_cost:.2f}. Cumulative fleet fuel cost: MYR {cum_cost:.2f}.",
                bottleneck_flow=1,
                cumulative_flow=cum_flow,
                cumulative_cost_myr=round(cum_cost, 2),
                augmenting_path_nodes=path_nodes,
                augmenting_path_edges=path_edges,
                edges=make_mcmf_snapshot(current_flows, set(path_edges)),
            )
        )

    stage4_graph_trace = NetworkFlowGraphTrace(
        graph_type="BIPARTITE_MIN_COST",
        nodes=graph_nodes,
        steps=timeline_steps,
    )

    itineraries: list[DispatchItinerary] = []
    total_fleet_fuel_cost = 0.0

    for t_idx, k_idx in matches:
        truck = fleet[t_idx]
        task = land_tasks[k_idx]
        meta = task_metadata[(t_idx, k_idx)]
        target_store = st_map[task.target_id]

        legs: list[TripLeg] = []

        # Leg 1: Deadhead to pickup warehouse (if distance > 0)
        if meta["deadhead_dist"] > 0.5:
            deadhead_liters = round(meta["deadhead_dist"] / truck.fuel_economy_kmpl, 2)
            deadhead_pts, deadhead_km, _ = get_corridor_waypoints(
                truck.current_location_name,
                task.source_name,
                truck.current_coords,
                meta["pickup_coords"],
            )
            legs.append(
                TripLeg(
                    leg_type=TripLegType.DEADHEAD_PICKUP,
                    origin_name=truck.current_location_name,
                    origin_coords=truck.current_coords,
                    destination_name=task.source_name,
                    destination_coords=meta["pickup_coords"],
                    distance_km=deadhead_km if deadhead_km > 0 else meta["deadhead_dist"],
                    transit_hours=round((deadhead_km if deadhead_km > 0 else meta["deadhead_dist"]) / 60.0, 1),
                    fuel_burned_liters=deadhead_liters,
                    fuel_cost_myr=round(deadhead_liters * economic_parameters.fuel_price_myr_per_liter, 2),
                    path_coordinates=deadhead_pts,
                )
            )

        # Leg 2: Haul to delivery store (guaranteeing realistic highway geometry)
        haul_pts = task.path_coordinates
        if not haul_pts or len(haul_pts) <= 2:
            resolved_pts, resolved_dist, _ = get_corridor_waypoints(
                task.source_name,
                target_store.name,
                meta["pickup_coords"],
                (target_store.latitude, target_store.longitude),
            )
            if resolved_pts and len(resolved_pts) > 1:
                haul_pts = resolved_pts

        haul_liters = round(meta["haul_dist"] / truck.fuel_economy_kmpl, 2)
        legs.append(
            TripLeg(
                leg_type=TripLegType.HAUL_DELIVERY,
                origin_name=task.source_name,
                origin_coords=meta["pickup_coords"],
                destination_name=target_store.name,
                destination_coords=(target_store.latitude, target_store.longitude),
                distance_km=meta["haul_dist"],
                transit_hours=round(meta["haul_dist"] / 65.0, 1),
                fuel_burned_liters=haul_liters,
                fuel_cost_myr=round(haul_liters * economic_parameters.fuel_price_myr_per_liter, 2),
                path_coordinates=haul_pts if haul_pts else [meta["pickup_coords"], (target_store.latitude, target_store.longitude)],
            )
        )

        truck.assigned_allocation_id = task.allocation_id
        truck.is_assigned = True

        itineraries.append(
            DispatchItinerary(
                itinerary_id=f"ITIN-{len(itineraries) + 1:03d}",
                truck_id=truck.truck_id,
                truck_name=truck.name,
                truck_image=truck.image_url,
                allocation_id=task.allocation_id,
                product_id=task.product_id,
                quantity_units=task.quantity,
                source_warehouse_id=task.source_id,
                source_warehouse_name=task.source_name,
                target_store_id=target_store.store_id,
                target_store_name=target_store.name,
                total_distance_km=meta["total_dist"],
                total_transit_hours=round(meta["total_dist"] / 65.0, 1),
                total_fuel_liters=meta["total_fuel_liters"],
                total_fuel_cost_myr=meta["total_fuel_cost"],
                legs=legs,
                refueling_stops=meta["refueling_stops"],
                is_refueled=len(meta["refueling_stops"]) > 0,
                status="SCHEDULED",
            )
        )
        total_fleet_fuel_cost += meta["total_fuel_cost"]

    # 4. Calculate Maritime Sea Freight and Air Freight Costs
    total_maritime_cost = 0.0
    for alloc in maritime_allocations:
        weight_kg = alloc.quantity * 20.0
        sea_cost = economic_parameters.intermodal_sea_base_fee_myr + (weight_kg * economic_parameters.intermodal_sea_per_kg_myr)
        total_maritime_cost += sea_cost

    total_air_cost = 0.0
    for alloc in air_allocations:
        weight_kg = alloc.quantity * 20.0
        air_cost = economic_parameters.intermodal_air_base_fee_myr + (weight_kg * economic_parameters.intermodal_air_per_kg_myr)
        total_air_cost += air_cost

    total_maritime_cost = round(total_maritime_cost, 2)
    total_air_cost = round(total_air_cost, 2)
    total_fleet_fuel_cost = round(total_fleet_fuel_cost, 2)
    total_transport_cost = round(total_fleet_fuel_cost + total_maritime_cost + total_air_cost, 2)
    budget_variance = round(budget_cap_myr - total_transport_cost, 2)
    is_budget_feasible = total_transport_cost <= budget_cap_myr

    unassigned_count = num_tasks - len(assigned_tasks_set)

    # 5. Emit Actionable Causal Audit Tokens
    tokens: list[str] = []
    if is_budget_feasible:
        tokens.append(
            f"[VERIFIED: BUDGET COMPLIANT] Total transport cost MYR {total_transport_cost:,.2f} "
            f"is within budget cap MYR {budget_cap_myr:,.2f} (Savings: MYR {budget_variance:,.2f})."
        )
    else:
        overage = abs(budget_variance)
        tokens.append(
            f"[FAIL: OVERBUDGET] Total transport cost MYR {total_transport_cost:,.2f} "
            f"exceeds budget cap MYR {budget_cap_myr:,.2f} (+MYR {overage:,.2f} overage)."
        )

    if total_air_cost > 0:
        tokens.append(
            f"[AIR FREIGHT AUDIT] Expedited Air Cargo dispatched: MYR {total_air_cost:,.2f} "
            f"across {len(air_allocations)} transshipment airway bill(s)."
        )

    refueled_itins = [itin for itin in itineraries if itin.is_refueled]
    for itin in refueled_itins:
        for st in itin.refueling_stops:
            tokens.append(
                f"[RANGE AUDIT] Truck {itin.truck_name} ({itin.truck_id}) refueling at {st.station_name} "
                f"({st.liters_refueled}L diesel, MYR {st.cost_myr:,.2f})."
            )

    if unassigned_count > 0:
        tokens.append(
            f"[FAIL: FLEET CAPACITY EXHAUSTED] {unassigned_count} delivery tasks could not be assigned "
            f"due to truck payload limits or fleet availability."
        )

    summary = (
        f"Stage 4 dispatch verified: {len(itineraries)} truck itineraries scheduled, "
        f"{len(refueled_itins)} refueling stops planned. "
        f"Total transport cost: MYR {total_transport_cost:,.2f} / MYR {budget_cap_myr:,.2f}."
    )

    return Stage4Result(
        is_budget_feasible=is_budget_feasible,
        total_fleet_fuel_cost_myr=total_fleet_fuel_cost,
        total_maritime_cost_myr=total_maritime_cost,
        total_air_cost_myr=total_air_cost,
        total_transport_cost_myr=total_transport_cost,
        budget_cap_myr=budget_cap_myr,
        budget_variance_myr=budget_variance,
        dispatched_trucks_count=len(itineraries),
        unassigned_tasks_count=unassigned_count,
        itineraries=itineraries,
        available_trucks=fleet,
        tokens=tokens,
        summary=summary,
        graph_trace=stage4_graph_trace,
    )
