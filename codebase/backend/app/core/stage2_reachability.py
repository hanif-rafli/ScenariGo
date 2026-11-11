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
    haversine_distance_km,
    road_distance_km,
    fetch_dynamic_road_path,
    MARITIME_PENANG_TO_KUCHING_WAYPOINTS,
    MARITIME_PORT_KLANG_TO_KUCHING_WAYPOINTS,
    MARITIME_PTP_JOHOR_TO_KUCHING_WAYPOINTS,
    MARITIME_CENTRAL_SCS_TO_SABAH_WAYPOINTS,
    AIR_KLIA_TO_KUCHING_WAYPOINTS,
    HIGHWAY_PENANG_TO_IPOH_WAYPOINTS,
    HIGHWAY_BUTTERWORTH_TO_IPOH_WAYPOINTS,
    HIGHWAY_IPOH_TO_KL_WAYPOINTS,
    HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS,
    HIGHWAY_PORT_KLANG_TO_SHAH_ALAM_WAYPOINTS,
    HIGHWAY_KL_TO_PTP_JOHOR_WAYPOINTS,
    HIGHWAY_PTP_TO_JB_WAYPOINTS,
    HIGHWAY_KUCHING_PORT_TO_CITY_WAYPOINTS,
    HIGHWAY_KLIA_TO_SHAH_ALAM_WAYPOINTS,
    HIGHWAY_KUCHING_AIRPORT_TO_CITY_WAYPOINTS,
    HIGHWAY_KLIA_TO_IPOH_WAYPOINTS,
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
        return [c1] + list(pts[1:-1]) + [c2], 985.0, Modality.AIR

    # 1. Maritime Shipping Fairways (cross-strait around Malay Peninsula)
    if is_cross_strait:
        # PTP Johor -> Kuching (Deepwater corridor through Singapore Strait TSS, clearing Tanjung Datu at >= 2.42N)
        if matches(name1, name2, "ptp", "kuching") or matches(name1, name2, "pelepas", "kuching") or matches(name1, name2, "johor", "kuching"):
            pts = (
                MARITIME_PTP_JOHOR_TO_KUCHING_WAYPOINTS
                if is_peninsular(c1[1])
                else list(reversed(MARITIME_PTP_JOHOR_TO_KUCHING_WAYPOINTS))
            )
            return [c1] + list(pts[1:-1]) + [c2], 840.0, Modality.MARITIME

        # Port Klang -> Kuching (Malacca Strait TSS to South China Sea fairway)
        if matches(name1, name2, "port klang", "kuching") or matches(name1, name2, "klang", "kuching") or matches(name1, name2, "kuala lumpur", "kuching"):
            pts = (
                MARITIME_PORT_KLANG_TO_KUCHING_WAYPOINTS
                if is_peninsular(c1[1])
                else list(reversed(MARITIME_PORT_KLANG_TO_KUCHING_WAYPOINTS))
            )
            return [c1] + list(pts[1:-1]) + [c2], 1320.0, Modality.MARITIME

        # Butterworth / Penang Port -> Kuching
        if matches(name1, name2, "butterworth", "kuching") or matches(name1, name2, "penang", "kuching"):
            pts = (
                MARITIME_PENANG_TO_KUCHING_WAYPOINTS
                if is_peninsular(c1[1])
                else list(reversed(MARITIME_PENANG_TO_KUCHING_WAYPOINTS))
            )
            return [c1] + list(pts[1:-1]) + [c2], 1510.4, Modality.MARITIME

        # Destination-Aware Fallback for Arbitrary Cross-Strait Harbors (Never drop to road chords)
        borneo_coord = c2 if not is_peninsular(c2[1]) else c1
        pen_coord = c1 if is_peninsular(c1[1]) else c2
        is_sabah_or_north = borneo_coord[0] >= 3.0 or any(
            k in name1.lower() or k in name2.lower() for k in ["sabah", "kinabalu", "sandakan", "labuan", "bintulu", "miri"]
        )

        if is_sabah_or_north:
            base_pts = MARITIME_CENTRAL_SCS_TO_SABAH_WAYPOINTS
            pts = base_pts if is_peninsular(c1[1]) else list(reversed(base_pts))
            return [c1] + list(pts[1:-1]) + [c2], 1450.0, Modality.MARITIME
        else:
            base_pts = (
                MARITIME_PENANG_TO_KUCHING_WAYPOINTS
                if pen_coord[0] > 4.5
                else MARITIME_PORT_KLANG_TO_KUCHING_WAYPOINTS
            )
            pts = base_pts if is_peninsular(c1[1]) else list(reversed(base_pts))
            dist = 1510.4 if pen_coord[0] > 4.5 else 1320.0
            return [c1] + list(pts[1:-1]) + [c2], dist, Modality.MARITIME

    # 2. Highway Road Corridors (following North-South Expressway, ELITE E6 & Borneo Highway alignment)
    # Butterworth NBCT Corridors
    if matches(name1, name2, "butterworth", "ipoh"):
        pts = (
            HIGHWAY_BUTTERWORTH_TO_IPOH_WAYPOINTS
            if "butterworth" in name1.lower()
            else list(reversed(HIGHWAY_BUTTERWORTH_TO_IPOH_WAYPOINTS))
        )
        return [c1] + list(pts[1:-1]) + [c2], 153.2, Modality.LAND

    if matches(name1, name2, "butterworth", "kuala lumpur"):
        full_pts = HIGHWAY_BUTTERWORTH_TO_IPOH_WAYPOINTS + HIGHWAY_IPOH_TO_KL_WAYPOINTS[1:]
        pts = (
            full_pts
            if "butterworth" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 350.5, Modality.LAND

    if matches(name1, name2, "butterworth", "shah alam"):
        full_pts = (
            HIGHWAY_BUTTERWORTH_TO_IPOH_WAYPOINTS
            + HIGHWAY_IPOH_TO_KL_WAYPOINTS[1:]
            + HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS[1:]
        )
        pts = (
            full_pts
            if "butterworth" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 375.7, Modality.LAND

    # Port Klang Gateway Highway Corridors
    if matches(name1, name2, "port klang", "shah alam") or matches(name1, name2, "klang", "shah alam"):
        pts = (
            HIGHWAY_PORT_KLANG_TO_SHAH_ALAM_WAYPOINTS
            if "klang" in name1.lower()
            else list(reversed(HIGHWAY_PORT_KLANG_TO_SHAH_ALAM_WAYPOINTS))
        )
        return [c1] + list(pts[1:-1]) + [c2], 18.5, Modality.LAND

    if matches(name1, name2, "port klang", "kuala lumpur") or matches(name1, name2, "klang", "kuala lumpur"):
        full_pts = HIGHWAY_PORT_KLANG_TO_SHAH_ALAM_WAYPOINTS + list(reversed(HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS))[1:]
        pts = (
            full_pts
            if "klang" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 43.7, Modality.LAND

    if matches(name1, name2, "port klang", "ipoh") or matches(name1, name2, "klang", "ipoh"):
        full_pts = (
            HIGHWAY_PORT_KLANG_TO_SHAH_ALAM_WAYPOINTS
            + list(reversed(HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS))[1:]
            + list(reversed(HIGHWAY_IPOH_TO_KL_WAYPOINTS))[1:]
        )
        pts = (
            full_pts
            if "klang" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 241.0, Modality.LAND

    # Port of Tanjung Pelepas (PTP Johor) & Southern Corridors
    if matches(name1, name2, "ptp", "johor") or matches(name1, name2, "pelepas", "johor"):
        pts = (
            HIGHWAY_PTP_TO_JB_WAYPOINTS
            if ("ptp" in name1.lower() or "pelepas" in name1.lower())
            else list(reversed(HIGHWAY_PTP_TO_JB_WAYPOINTS))
        )
        return [c1] + list(pts[1:-1]) + [c2], 28.5, Modality.LAND

    if matches(name1, name2, "ptp", "kuala lumpur") or matches(name1, name2, "pelepas", "kuala lumpur"):
        pts = (
            list(reversed(HIGHWAY_KL_TO_PTP_JOHOR_WAYPOINTS))
            if ("ptp" in name1.lower() or "pelepas" in name1.lower())
            else HIGHWAY_KL_TO_PTP_JOHOR_WAYPOINTS
        )
        return [c1] + list(pts[1:-1]) + [c2], 328.0, Modality.LAND

    if matches(name1, name2, "ptp", "shah alam") or matches(name1, name2, "pelepas", "shah alam"):
        full_pts = list(reversed(HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS)) + HIGHWAY_KL_TO_PTP_JOHOR_WAYPOINTS[1:]
        pts = (
            list(reversed(full_pts))
            if ("ptp" in name1.lower() or "pelepas" in name1.lower())
            else full_pts
        )
        return [c1] + list(pts[1:-1]) + [c2], 353.2, Modality.LAND

    if matches(name1, name2, "kuala lumpur", "johor"):
        full_pts = HIGHWAY_KL_TO_PTP_JOHOR_WAYPOINTS + HIGHWAY_PTP_TO_JB_WAYPOINTS[1:]
        pts = (
            full_pts
            if "kuala lumpur" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 356.5, Modality.LAND

    if matches(name1, name2, "shah alam", "johor"):
        full_pts = (
            list(reversed(HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS))
            + HIGHWAY_KL_TO_PTP_JOHOR_WAYPOINTS[1:]
            + HIGHWAY_PTP_TO_JB_WAYPOINTS[1:]
        )
        pts = (
            full_pts
            if "shah alam" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 381.7, Modality.LAND

    if matches(name1, name2, "penang", "kuala lumpur"):
        full_pts = HIGHWAY_PENANG_TO_IPOH_WAYPOINTS + HIGHWAY_IPOH_TO_KL_WAYPOINTS[1:]
        pts = (
            full_pts
            if "penang" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 354.7, Modality.LAND

    if matches(name1, name2, "penang", "shah alam"):
        full_pts = (
            HIGHWAY_PENANG_TO_IPOH_WAYPOINTS
            + HIGHWAY_IPOH_TO_KL_WAYPOINTS[1:]
            + HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS[1:]
        )
        pts = (
            full_pts
            if "penang" in name1.lower()
            else list(reversed(full_pts))
        )
        return [c1] + list(pts[1:-1]) + [c2], 379.9, Modality.LAND

    if matches(name1, name2, "penang", "ipoh"):
        pts = (
            HIGHWAY_PENANG_TO_IPOH_WAYPOINTS
            if "penang" in name1.lower()
            else list(reversed(HIGHWAY_PENANG_TO_IPOH_WAYPOINTS))
        )
        return [c1] + list(pts[1:-1]) + [c2], 157.4, Modality.LAND

    # Detect if either node is KLIA / Sepang (lat < 2.9 in Peninsular, or 'klia' / 'air cargo' in name)
    is_n1_klia = "klia" in name1.lower() or ("cargo" in name1.lower() and is_peninsular(c1[1])) or (c1[0] < 2.9 and is_peninsular(c1[1]))
    is_n2_klia = "klia" in name2.lower() or ("cargo" in name2.lower() and is_peninsular(c2[1])) or (c2[0] < 2.9 and is_peninsular(c2[1]))
    is_klia_corridor = is_n1_klia or is_n2_klia

    if is_klia_corridor:
        if matches(name1, name2, "shah alam", "klia") or matches(name1, name2, "shah alam", "kuala lumpur") or "shah alam" in name1.lower() or "shah alam" in name2.lower():
            pts = (
                HIGHWAY_KLIA_TO_SHAH_ALAM_WAYPOINTS
                if is_n1_klia
                else list(reversed(HIGHWAY_KLIA_TO_SHAH_ALAM_WAYPOINTS))
            )
            return [c1] + list(pts[1:-1]) + [c2], 48.9, Modality.LAND

        if matches(name1, name2, "ipoh", "klia") or matches(name1, name2, "ipoh", "kuala lumpur") or "ipoh" in name1.lower() or "ipoh" in name2.lower():
            pts = (
                HIGHWAY_KLIA_TO_IPOH_WAYPOINTS
                if is_n1_klia
                else list(reversed(HIGHWAY_KLIA_TO_IPOH_WAYPOINTS))
            )
            return [c1] + list(pts[1:-1]) + [c2], 240.4, Modality.LAND

    # Non-KLIA Peninsular Corridors (KL City Center)
    if matches(name1, name2, "ipoh", "kuala lumpur"):
        pts = (
            HIGHWAY_IPOH_TO_KL_WAYPOINTS
            if "ipoh" in name1.lower()
            else list(reversed(HIGHWAY_IPOH_TO_KL_WAYPOINTS))
        )
        return [c1] + list(pts[1:-1]) + [c2], 197.3, Modality.LAND

    if matches(name1, name2, "kuala lumpur", "shah alam"):
        pts = (
            HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS
            if "kuala lumpur" in name1.lower()
            else list(reversed(HIGHWAY_KL_TO_SHAH_ALAM_WAYPOINTS))
        )
        return [c1] + list(pts[1:-1]) + [c2], 25.2, Modality.LAND

    # Borneo Corridors (Kuching Airport Hub vs Kuching Sea Port / Transshipment)
    if not is_cross_strait and ("kuching" in name1.lower() or "kuching" in name2.lower()):
        is_n1_airport = "airport" in name1.lower() or ("cargo" in name1.lower() and not is_peninsular(c1[1])) or c1[0] < 1.51
        is_n2_airport = "airport" in name2.lower() or ("cargo" in name2.lower() and not is_peninsular(c2[1])) or c2[0] < 1.51
        is_kch_airport = is_n1_airport or is_n2_airport

        if is_kch_airport:
            pts = (
                HIGHWAY_KUCHING_AIRPORT_TO_CITY_WAYPOINTS
                if is_n1_airport
                else list(reversed(HIGHWAY_KUCHING_AIRPORT_TO_CITY_WAYPOINTS))
            )
            return [c1] + list(pts[1:-1]) + [c2], 9.3, Modality.LAND
        else:
            pts = (
                HIGHWAY_KUCHING_PORT_TO_CITY_WAYPOINTS
                if ("transshipment" in name1.lower() or "port" in name1.lower() or c1[0] > 1.54)
                else list(reversed(HIGHWAY_KUCHING_PORT_TO_CITY_WAYPOINTS))
            )
            return [c1] + list(pts[1:-1]) + [c2], 5.9, Modality.LAND

    # Dynamic fallback for arbitrary/custom coordinates (OSRM or highway terrain spline)
    pts, dist = fetch_dynamic_road_path(c1, c2)
    if len(pts) >= 2:
        pts = [c1] + list(pts[1:-1]) + [c2]
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

    # Connect maritime ports across Peninsular and Borneo if active
    ports = [w for w in warehouses if w.is_port]
    pen_ports = [w for w in ports if is_peninsular(w.longitude)]
    bor_ports = [w for w in ports if not is_peninsular(w.longitude)]
    for pp in pen_ports:
        for bp in bor_ports:
            if (pp.name, bp.name) not in connected_pairs and (bp.name, pp.name) not in connected_pairs:
                connected_pairs.append((pp.name, bp.name))

    # Match named hubs and stores in Peninsular
    pen_warehouses = [w for w in warehouses if is_peninsular(w.longitude)]
    pen_stores = [s for s in stores if is_peninsular(s.longitude)]
    for pw in pen_warehouses:
        for ps in pen_stores:
            if (
                matches(pw.name, ps.name, "kuala lumpur", "shah alam")
                or matches(pw.name, ps.name, "klia", "shah alam")
                or matches(pw.name, ps.name, "port klang", "shah alam")
                or matches(pw.name, ps.name, "klang", "shah alam")
            ):
                if (pw.name, ps.name) not in connected_pairs and (ps.name, pw.name) not in connected_pairs:
                    connected_pairs.append((pw.name, ps.name))

            if matches(pw.name, ps.name, "penang", "ipoh") or matches(pw.name, ps.name, "butterworth", "ipoh"):
                if (pw.name, ps.name) not in connected_pairs and (ps.name, pw.name) not in connected_pairs:
                    connected_pairs.append((pw.name, ps.name))

            if matches(pw.name, ps.name, "ipoh", "kuala lumpur") or matches(pw.name, ps.name, "ipoh", "klia"):
                if (pw.name, ps.name) not in connected_pairs and (ps.name, pw.name) not in connected_pairs:
                    connected_pairs.append((pw.name, ps.name))

            if matches(pw.name, ps.name, "ptp", "johor") or matches(pw.name, ps.name, "pelepas", "johor") or matches(pw.name, ps.name, "johor", "johor"):
                if (pw.name, ps.name) not in connected_pairs and (ps.name, pw.name) not in connected_pairs:
                    connected_pairs.append((pw.name, ps.name))

    # Connect trunk warehouse-to-warehouse highway links in Peninsular
    for i, pw1 in enumerate(pen_warehouses):
        for pw2 in pen_warehouses[i + 1:]:
            if (
                matches(pw1.name, pw2.name, "kuala lumpur", "port klang")
                or matches(pw1.name, pw2.name, "kuala lumpur", "klang")
                or matches(pw1.name, pw2.name, "kuala lumpur", "ptp")
                or matches(pw1.name, pw2.name, "kuala lumpur", "pelepas")
                or matches(pw1.name, pw2.name, "kuala lumpur", "butterworth")
            ):
                if (pw1.name, pw2.name) not in connected_pairs and (pw2.name, pw1.name) not in connected_pairs:
                    connected_pairs.append((pw1.name, pw2.name))

    # Connect orphan Peninsular stores to nearest Peninsular warehouse
    for ps in pen_stores:
        if not any(ps.name == p[0] or ps.name == p[1] for p in connected_pairs):
            if pen_warehouses:
                nearest_pw = min(
                    pen_warehouses,
                    key=lambda w: haversine_distance_km(ps.latitude, ps.longitude, w.latitude, w.longitude)
                )
                connected_pairs.append((nearest_pw.name, ps.name))

    # Connect orphan Borneo stores to nearest Borneo warehouse
    for bs in bor_stores:
        if not any(bs.name == p[0] or bs.name == p[1] for p in connected_pairs):
            if bor_warehouses:
                nearest_bw = min(
                    bor_warehouses,
                    key=lambda w: haversine_distance_km(bs.latitude, bs.longitude, w.latitude, w.longitude)
                )
                connected_pairs.append((nearest_bw.name, bs.name))

    # Guarantee every warehouse has at least one land edge if facilities exist on the same landmass
    for pw in pen_warehouses:
        if not any(pw.name == p[0] or pw.name == p[1] for p in connected_pairs):
            other_pen = [w for w in pen_warehouses if w.warehouse_id != pw.warehouse_id] or pen_stores
            if other_pen:
                nearest = min(other_pen, key=lambda n: haversine_distance_km(pw.latitude, pw.longitude, n.latitude, n.longitude))
                connected_pairs.append((pw.name, nearest.name))

    for bw in bor_warehouses:
        if not any(bw.name == p[0] or bw.name == p[1] for p in connected_pairs):
            other_bor = [w for w in bor_warehouses if w.warehouse_id != bw.warehouse_id] or bor_stores
            if other_bor:
                nearest = min(other_bor, key=lambda n: haversine_distance_km(bw.latitude, bw.longitude, n.latitude, n.longitude))
                connected_pairs.append((bw.name, nearest.name))

    def are_connected(n1: str, n2: str, pairs: list[tuple[str, str]]) -> bool:
        adj: dict[str, set[str]] = {}
        for a, b in pairs:
            adj.setdefault(a, set()).add(b)
            adj.setdefault(b, set()).add(a)
        if n1 not in adj or n2 not in adj:
            return False
        visited = {n1}
        queue = [n1]
        while queue:
            curr = queue.pop(0)
            if curr == n2:
                return True
            for nxt in adj.get(curr, set()):
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)
        return False

    # Guarantee full highway reachability across all Peninsular warehouses without redundant edges
    for i in range(len(pen_warehouses) - 1):
        pw_a = pen_warehouses[i].name
        pw_b = pen_warehouses[i + 1].name
        if not are_connected(pw_a, pw_b, connected_pairs):
            connected_pairs.append((pw_a, pw_b))

    # Guarantee all Borneo warehouses connect over land if multiple exist and disconnected
    for i in range(len(bor_warehouses) - 1):
        bw_a = bor_warehouses[i].name
        bw_b = bor_warehouses[i + 1].name
        if not are_connected(bw_a, bw_b, connected_pairs):
            connected_pairs.append((bw_a, bw_b))

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
                        (sid for sid in comp.store_ids if st_map[sid].requests.get(pid, 0) > 0),
                        comp.store_ids[0] if comp.store_ids else 0
                    )
                    cand_whs = [
                        wid for wid in surplus_comp.warehouse_ids
                        if wh_map[wid].inventory.get(pid, 0) > 0
                    ]
                    if not cand_whs:
                        continue
                    # Select warehouse with largest inventory for this product
                    source_wh_id = max(cand_whs, key=lambda wid: wh_map[wid].inventory.get(pid, 0))

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
                        dep_port = (
                            min(
                                peninsular_ports,
                                key=lambda p: haversine_distance_km(
                                    wh_map[source_wh_id].latitude,
                                    wh_map[source_wh_id].longitude,
                                    p.latitude,
                                    p.longitude,
                                ),
                            )
                            if peninsular_ports
                            else None
                        )
                        arr_port = (
                            min(
                                borneo_ports,
                                key=lambda p: haversine_distance_km(
                                    st_map[target_store_id].latitude,
                                    st_map[target_store_id].longitude,
                                    p.latitude,
                                    p.longitude,
                                ),
                            )
                            if borneo_ports
                            else None
                        )

                        if dep_port and arr_port:
                            pts, dist, _ = get_corridor_waypoints(
                                dep_port.name,
                                arr_port.name,
                                (dep_port.latitude, dep_port.longitude),
                                (arr_port.latitude, arr_port.longitude),
                            )
                            sea_hours = round(dist / 32.0, 1)
                        else:
                            pts = MARITIME_PENANG_TO_KUCHING_WAYPOINTS
                            dist = 1510.4
                            sea_hours = 47.2

                        route_token = (
                            f"[INFO: INTERMODAL REQUIRED] Store S{target_store_id} ({st_map[target_store_id].name}) "
                            f"demands {shortfall} units P{pid}. No land warehouse stocks P{pid} in {comp.name}. "
                            f"Routed via {dep_port.name if dep_port else 'Departure Port'} -> "
                            f"{arr_port.name if arr_port else 'Arrival Port'} [SEA FAIRWAY: {dist:,.0f} km | ~{sea_hours} hrs]."
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
                                sea_distance_km=dist,
                                sea_transit_hours=sea_hours,
                                estimated_carrier_cost_myr=round(450.0 + (shortfall * 5.0 * 0.85), 2),
                                token_text=route_token,
                                modality=Modality.MARITIME,
                                path_coordinates=pts,
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
