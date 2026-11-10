from collections import defaultdict, deque
from app.models.entities import Warehouse, Store
from app.models.graph import (
    Modality,
    NetworkEdge,
    ComponentInfo,
    IntermodalRoute,
    Stage2Result,
)
from app.data.malaysia_network import (
    road_distance_km,
    fetch_dynamic_road_path,
    MARITIME_PENANG_TO_KUCHING_WAYPOINTS,
    MARITIME_PORT_KLANG_TO_KUCHING_WAYPOINTS,
    AIR_KLIA_TO_KUCHING_WAYPOINTS,
    HIGHWAY_PENANG_TO_IPOH_WAYPOINTS,
    HIGHWAY_IPOH_TO_KL_WAYPOINTS,
    HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS,
    HIGHWAY_KUCHING_PORT_TO_CITY_WAYPOINTS,
)


def is_peninsular(longitude: float) -> bool:
    """Classifies GPS coordinate into Peninsular (<105.0) vs Borneo (>=105.0)."""
    return longitude < 105.0


def matches(n1: str, n2: str, key1: str, key2: str) -> bool:
    """Case-insensitive substring matcher for network node pairs."""
    k1 = key1.lower()
    k2 = key2.lower()
    lower1 = n1.lower()
    lower2 = n2.lower()
    return (k1 in lower1 and k2 in lower2) or (k2 in lower1 and k1 in lower2)


def get_corridor_waypoints(
    name1: str,
    name2: str,
    c1: tuple[float, float],
    c2: tuple[float, float],
) -> tuple[list[tuple[float, float]], float, Modality]:
    """Matches two nodes to their realistic GIS highway, maritime fairway, or air flight geometry."""
    is_cross_strait = is_peninsular(c1[1]) != is_peninsular(c2[1])

    # 0. Air Freight Flight Corridors (strictly cross-strait between Peninsular and Borneo)
    if is_cross_strait and (
        matches(name1, name2, "klia", "kuching")
        or matches(name1, name2, "air", "kuching")
        or (matches(name1, name2, "kuala lumpur", "kuching") and ("cargo" in name1.lower() or "cargo" in name2.lower() or "air" in name1.lower() or "air" in name2.lower()))
    ):
        pts = (
            AIR_KLIA_TO_KUCHING_WAYPOINTS
            if is_peninsular(c1[1])
            else list(reversed(AIR_KLIA_TO_KUCHING_WAYPOINTS))
        )
        return pts, 985.0, Modality.AIR

    # 1. Maritime Shipping Fairways (cross-strait around Malay Peninsula)
    if is_cross_strait:
        if matches(name1, name2, "penang", "kuching"):
            pts = (
                MARITIME_PENANG_TO_KUCHING_WAYPOINTS
                if is_peninsular(c1[1])
                else list(reversed(MARITIME_PENANG_TO_KUCHING_WAYPOINTS))
            )
            return pts, 1510.4, Modality.MARITIME

        if matches(name1, name2, "kuala lumpur", "kuching") or matches(name1, name2, "port klang", "kuching"):
            pts = (
                MARITIME_PORT_KLANG_TO_KUCHING_WAYPOINTS
                if is_peninsular(c1[1])
                else list(reversed(MARITIME_PORT_KLANG_TO_KUCHING_WAYPOINTS))
            )
            return pts, 1320.0, Modality.MARITIME

    # 2. Highway Road Corridors (following North-South Expressway & Federal Route alignment)
    if matches(name1, name2, "penang", "ipoh"):
        pts = (
            HIGHWAY_PENANG_TO_IPOH_WAYPOINTS
            if "penang" in name1.lower()
            else list(reversed(HIGHWAY_PENANG_TO_IPOH_WAYPOINTS))
        )
        return pts, 157.4, Modality.LAND

    if matches(name1, name2, "ipoh", "kuala lumpur") or matches(name1, name2, "ipoh", "klia"):
        pts = (
            HIGHWAY_IPOH_TO_KL_WAYPOINTS
            if "ipoh" in name1.lower()
            else list(reversed(HIGHWAY_IPOH_TO_KL_WAYPOINTS))
        )
        return pts, 197.3, Modality.LAND

    if matches(name1, name2, "kuala lumpur", "shah alam") or matches(name1, name2, "klia", "shah alam"):
        pts = (
            HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS
            if ("kuala lumpur" in name1.lower() or "klia" in name1.lower())
            else list(reversed(HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS))
        )
        return pts, 25.2, Modality.LAND

    if (
        matches(name1, name2, "kuching", "central")
        or matches(name1, name2, "transshipment", "central")
        or (not is_cross_strait and "kuching" in name1.lower() and "kuching" in name2.lower())
    ):
        pts = (
            HIGHWAY_KUCHING_PORT_TO_CITY_WAYPOINTS
            if ("transshipment" in name1.lower() or "port" in name1.lower() or "cargo" in name1.lower() or "hub" in name1.lower())
            else list(reversed(HIGHWAY_KUCHING_PORT_TO_CITY_WAYPOINTS))
        )
        return pts, 5.9, Modality.LAND

    # Dynamic fallback for arbitrary/custom coordinates (OSRM or highway terrain spline)
    pts, dist = fetch_dynamic_road_path(c1, c2)
    return pts, dist, Modality.LAND


def build_network_edges(
    warehouses: list[Warehouse],
    stores: list[Store],
) -> list[NetworkEdge]:
    """Constructs multi-modal edge list with realistic GIS waypoint paths.
    
    Eliminates naive direct chords cutting across landmasses and connects nodes
    strictly through actual highway arteries and maritime fairway channels.
    """
    edges: list[NetworkEdge] = []

    all_nodes = [
        {"id": w.warehouse_id, "name": w.name, "coords": (w.latitude, w.longitude), "is_wh": True, "is_port": w.is_port, "is_airport": w.is_airport}
        for w in warehouses
    ] + [
        {"id": 1000 + s.store_id, "name": s.name, "coords": (s.latitude, s.longitude), "is_wh": False, "is_port": False, "is_airport": False}
        for s in stores
    ]

    # Pre-defined realistic topology segments for Bob's Stationery benchmark
    connected_pairs = [
        ("Penang Logistics Dep", "Ipoh Supermarket"),
        ("Ipoh Supermarket", "Kuala Lumpur Hub"),
        ("Kuala Lumpur Hub", "Shah Alam Retail"),
        ("Kuching Transshipment", "Kuching Central Mall"),
        ("Penang Logistics Dep", "Kuching Transshipment"),
    ]

    # Dynamically connect airport pairs across Peninsular and Borneo if active
    airports = [w for w in warehouses if w.is_airport]
    pen_airports = [w for w in airports if is_peninsular(w.longitude)]
    bor_airports = [w for w in airports if not is_peninsular(w.longitude)]
    for pa in pen_airports:
        for ba in bor_airports:
            if (pa.name, ba.name) not in connected_pairs and (ba.name, pa.name) not in connected_pairs:
                connected_pairs.append((pa.name, ba.name))

    # Connect Borneo airport hubs to Borneo stores if not already present
    bor_warehouses = [w for w in warehouses if not is_peninsular(w.longitude)]
    bor_stores = [s for s in stores if not is_peninsular(s.longitude)]
    for bw in bor_warehouses:
        for bs in bor_stores:
            if (bw.name, bs.name) not in connected_pairs and (bs.name, bw.name) not in connected_pairs:
                connected_pairs.append((bw.name, bs.name))

    # Match named hubs in Peninsular (e.g. KLIA Cargo Hub -> Shah Alam, Ipoh -> KLIA Hub)
    pen_warehouses = [w for w in warehouses if is_peninsular(w.longitude)]
    pen_stores = [s for s in stores if is_peninsular(s.longitude)]
    for pw in pen_warehouses:
        for ps in pen_stores:
            if matches(pw.name, ps.name, "kuala lumpur", "shah alam") or matches(pw.name, ps.name, "klia", "shah alam"):
                if (pw.name, ps.name) not in connected_pairs and (ps.name, pw.name) not in connected_pairs:
                    connected_pairs.append((pw.name, ps.name))
            if matches(pw.name, ps.name, "penang", "ipoh"):
                if (pw.name, ps.name) not in connected_pairs and (ps.name, pw.name) not in connected_pairs:
                    connected_pairs.append((pw.name, ps.name))
            if matches(pw.name, ps.name, "ipoh", "kuala lumpur") or matches(pw.name, ps.name, "ipoh", "klia"):
                if (pw.name, ps.name) not in connected_pairs and (ps.name, pw.name) not in connected_pairs:
                    connected_pairs.append((pw.name, ps.name))

    node_by_name = {n["name"]: n for n in all_nodes}

    for name_a, name_b in connected_pairs:
        if name_a in node_by_name and name_b in node_by_name:
            na = node_by_name[name_a]
            nb = node_by_name[name_b]

            path_pts, dist, mod = get_corridor_waypoints(
                na["name"], nb["name"], na["coords"], nb["coords"]
            )

            is_maritime = mod == Modality.MARITIME
            is_air = mod == Modality.AIR
            speed = 550.0 if is_air else (32.0 if is_maritime else 65.0)
            transit_h = round(dist / speed, 1)

            edges.append(
                NetworkEdge(
                    source_id=na["id"],
                    target_id=nb["id"],
                    source_name=na["name"],
                    target_name=nb["name"],
                    source_coords=na["coords"],
                    target_coords=nb["coords"],
                    distance_km=dist,
                    modality=mod,
                    transit_hours=transit_h,
                    cost_per_kg_myr=4.50 if is_air else (0.85 if is_maritime else 0.0),
                    base_fee_myr=1200.0 if is_air else (450.0 if is_maritime else 0.0),
                    path_coordinates=path_pts,
                )
            )

    return edges


def evaluate_reachability(
    warehouses: list[Warehouse],
    stores: list[Store],
) -> Stage2Result:
    """Stage 2: Topo-Reachability & Subgraph Partitioning on realistic transport layers."""
    edges = build_network_edges(warehouses, stores)
    land_edges = [e for e in edges if e.modality == Modality.LAND]

    wh_map = {w.warehouse_id: w for w in warehouses}
    st_map = {s.store_id: s for s in stores}
    all_wh_ids = set(wh_map.keys())
    all_st_ids = set(st_map.keys())

    # Build adjacency list for land edges
    adj: dict[int, list[int]] = defaultdict(list)
    for e in land_edges:
        adj[e.source_id].append(e.target_id)
        adj[e.target_id].append(e.source_id)

    # BFS Connected Component labeling
    visited: set[int] = set()
    components: list[ComponentInfo] = []
    comp_counter = 0

    all_graph_node_ids = set(all_wh_ids) | {1000 + sid for sid in all_st_ids}

    for start_node in sorted(all_graph_node_ids):
        if start_node in visited:
            continue

        comp_wh_ids: list[int] = []
        comp_st_ids: list[int] = []
        queue = deque([start_node])
        visited.add(start_node)

        while queue:
            curr = queue.popleft()
            if curr < 1000:
                comp_wh_ids.append(curr)
            else:
                comp_st_ids.append(curr - 1000)

            for neighbor in adj[curr]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        comp_supply: dict[str, int] = defaultdict(int)
        for wid in comp_wh_ids:
            for pid, qty in wh_map[wid].inventory.items():
                comp_supply[str(pid)] += qty

        comp_demand: dict[str, int] = defaultdict(int)
        for sid in comp_st_ids:
            for pid, qty in st_map[sid].requests.items():
                comp_demand[str(pid)] += qty

        unmet: dict[str, int] = {}
        for pid, req in comp_demand.items():
            avail = comp_supply.get(pid, 0)
            if avail < req:
                unmet[pid] = req - avail

        is_pen = any(is_peninsular(wh_map[wid].longitude) for wid in comp_wh_ids) if comp_wh_ids else True
        comp_name = "Peninsular Malaysia Subgraph" if is_pen else "Borneo / East Malaysia Subgraph"

        components.append(
            ComponentInfo(
                component_id=comp_counter,
                name=f"Component {comp_counter}: {comp_name}",
                warehouse_ids=sorted(comp_wh_ids),
                store_ids=sorted(comp_st_ids),
                total_supply=dict(comp_supply),
                total_demand=dict(comp_demand),
                is_self_sufficient=len(unmet) == 0,
                unmet_demand=unmet,
            )
        )
        comp_counter += 1

    # Match unmet island demands with surplus components via port or airport gateways
    intermodal_routes: list[IntermodalRoute] = []
    tokens: list[str] = []

    ports = [w for w in warehouses if w.is_port]
    airports = [w for w in warehouses if w.is_airport]
    peninsular_ports = [p for p in ports if is_peninsular(p.longitude)]
    borneo_ports = [p for p in ports if not is_peninsular(p.longitude)]
    peninsular_airports = [a for a in airports if is_peninsular(a.longitude)]
    borneo_airports = [a for a in airports if not is_peninsular(a.longitude)]

    for comp in components:
        if comp.is_self_sufficient:
            tokens.append(
                f"[OK: LAND SELF-SUFFICIENT] {comp.name} has sufficient local supply for all store requests."
            )
        else:
            for pid, shortfall in comp.unmet_demand.items():
                surplus_comp = next(
                    (
                        c for c in components
                        if c.component_id != comp.component_id
                        and (c.total_supply.get(pid, 0) - c.total_demand.get(pid, 0)) >= shortfall
                    ),
                    None
                )

                if surplus_comp:
                    target_store_id = next(
                        sid for sid in comp.store_ids if st_map[sid].requests.get(pid, 0) > 0
                    )
                    source_wh_id = next(
                        wid for wid in surplus_comp.warehouse_ids if wh_map[wid].inventory.get(pid, 0) >= shortfall
                    )

                    # Prefer air corridor if airport gateways are explicitly established on both landmasses
                    use_air = bool(peninsular_airports and borneo_airports and not (peninsular_ports and borneo_ports))

                    if use_air:
                        dep_hub = peninsular_airports[0]
                        arr_hub = borneo_airports[0]
                        air_fee = round(1200.0 + (shortfall * 20.0 * 4.50), 2)
                        route_token = (
                            f"[INFO: AIR INTERMODAL REQUIRED] Store S{target_store_id} ({st_map[target_store_id].name}) "
                            f"demands {shortfall} units P{pid}. No land warehouse stocks P{pid} in {comp.name}. "
                            f"Routed via {dep_hub.name} -> {arr_hub.name} [AIR FREIGHT: 985 km | ~1.8 hrs]."
                        )
                        tokens.append(route_token)

                        intermodal_routes.append(
                            IntermodalRoute(
                                source_warehouse_id=source_wh_id,
                                source_warehouse_name=wh_map[source_wh_id].name,
                                departure_port_id=dep_hub.warehouse_id,
                                departure_port_name=dep_hub.name,
                                arrival_port_id=arr_hub.warehouse_id,
                                arrival_port_name=arr_hub.name,
                                target_store_id=target_store_id,
                                target_store_name=st_map[target_store_id].name,
                                product_id=pid,
                                quantity=shortfall,
                                sea_distance_km=985.0,
                                sea_transit_hours=1.8,
                                estimated_carrier_cost_myr=air_fee,
                                token_text=route_token,
                                modality=Modality.AIR,
                                path_coordinates=AIR_KLIA_TO_KUCHING_WAYPOINTS,
                            )
                        )
                    else:
                        dep_port = peninsular_ports[0] if peninsular_ports else None
                        arr_port = borneo_ports[0] if borneo_ports else None

                        route_token = (
                            f"[INFO: INTERMODAL REQUIRED] Store S{target_store_id} ({st_map[target_store_id].name}) "
                            f"demands {shortfall} units P{pid}. No land warehouse stocks P{pid} in {comp.name}. "
                            f"Routed via {dep_port.name if dep_port else 'Penang Port'} -> "
                            f"{arr_port.name if arr_port else 'Kuching Port'} [SEA FAIRWAY: 1,510 km]."
                        )
                        tokens.append(route_token)

                        intermodal_routes.append(
                            IntermodalRoute(
                                source_warehouse_id=source_wh_id,
                                source_warehouse_name=wh_map[source_wh_id].name,
                                departure_port_id=dep_port.warehouse_id if dep_port else source_wh_id,
                                departure_port_name=dep_port.name if dep_port else "Departure Port",
                                arrival_port_id=arr_port.warehouse_id if arr_port else 2,
                                arrival_port_name=arr_port.name if arr_port else "Arrival Port",
                                target_store_id=target_store_id,
                                target_store_name=st_map[target_store_id].name,
                                product_id=pid,
                                quantity=shortfall,
                                sea_distance_km=1510.4,
                                sea_transit_hours=47.2,
                                estimated_carrier_cost_myr=round(450.0 + (shortfall * 5.0 * 0.85), 2),
                                token_text=route_token,
                                modality=Modality.MARITIME,
                                path_coordinates=MARITIME_PENANG_TO_KUCHING_WAYPOINTS,
                            )
                        )

    summary = (
        f"[VERIFIED: REACHABILITY PARTITIONED] Network partitioned into {len(components)} disconnected components. "
        f"{len(intermodal_routes)} cross-strait intermodal routing requirements identified."
    )

    return Stage2Result(
        components=components,
        edges=edges,
        intermodal_routes=intermodal_routes,
        tokens=tokens,
        summary=summary,
    )
