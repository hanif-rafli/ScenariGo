"""Stage 3: Multi-Commodity Network Flow with Demands & Lower Bounds.

Implements Ford-Fulkerson circulation with lower bounds (adapted from Discrete Optimization Principles).
Solves the exact multi-echelon inventory allocation matrix across Peninsular and East Malaysia,
enforcing non-negotiable retail store requests as lower bounds [L, C] and identifying transport bottlenecks.
"""

from collections import deque, defaultdict
from typing import Any
from app.models.entities import Warehouse, Store
from app.models.graph import Modality
from app.models.graph_trace import (
    GraphNode,
    GraphEdgeSnapshot,
    GraphIterationStep,
    NetworkFlowGraphTrace,
)
from app.models.flow import (
    AllocationStatus,
    RouteType,
    BottleneckType,
    BottleneckDetail,
    AllocationItem,
    FlowEdgeUtilization,
    Stage3Result,
)
from app.core.stage2_reachability import evaluate_reachability, get_corridor_waypoints
from app.data.malaysia_network import MARITIME_PENANG_TO_KUCHING_WAYPOINTS


class FlowEdge:
    """Directed edge in the residual flow network with capacity and lower bounds."""

    def __init__(
        self,
        u: int,
        v: int,
        capacity: int,
        lower_bound: int = 0,
        meta: dict[str, Any] | None = None,
    ):
        self.u = u
        self.v = v
        self.capacity = capacity
        self.lower_bound = lower_bound
        self.flow = 0
        self.residual_capacity = capacity - lower_bound
        self.rev: FlowEdge | None = None
        self.meta: dict[str, Any] = meta or {}

    def __repr__(self) -> str:
        return f"FlowEdge({self.u} -> {self.v}, flow={self.flow}/{self.capacity}, LB={self.lower_bound})"


class ResidualNetwork:
    """Adjacency list residual graph with BFS augmenting path (Edmonds-Karp)."""

    def __init__(self, node_count: int):
        self.n = node_count
        self.adj: list[list[FlowEdge]] = [[] for _ in range(node_count)]
        self.edges: list[FlowEdge] = []

    def add_edge(
        self,
        u: int,
        v: int,
        capacity: int,
        lower_bound: int = 0,
        meta: dict[str, Any] | None = None,
    ) -> FlowEdge:
        forward = FlowEdge(u, v, capacity, lower_bound, meta)
        backward = FlowEdge(v, u, 0, 0, {"is_back_edge": True})
        forward.rev = backward
        backward.rev = forward
        self.adj[u].append(forward)
        self.adj[v].append(backward)
        self.edges.append(forward)
        return forward

    def bfs_find_path(self, source: int, sink: int) -> tuple[int, list[FlowEdge]]:
        """Finds shortest augmenting path in the residual network via BFS."""
        parent_edge: dict[int, FlowEdge] = {}
        visited = {source}
        queue = deque([source])

        while queue:
            curr = queue.popleft()
            if curr == sink:
                break

            for edge in self.adj[curr]:
                if edge.v not in visited and edge.residual_capacity > 0:
                    visited.add(edge.v)
                    parent_edge[edge.v] = edge
                    queue.append(edge.v)

        if sink not in parent_edge:
            return 0, []

        # Find bottleneck capacity along the augmenting path
        curr = sink
        bottleneck = float("inf")
        path: list[FlowEdge] = []

        while curr != source:
            edge = parent_edge[curr]
            bottleneck = min(bottleneck, edge.residual_capacity)
            path.append(edge)
            curr = edge.u

        return int(bottleneck), path

    def edmonds_karp(self, source: int, sink: int) -> int:
        """Executes Edmonds-Karp maximum flow algorithm."""
        total_flow = 0
        while True:
            bottleneck, path = self.bfs_find_path(source, sink)
            if bottleneck <= 0:
                break

            total_flow += bottleneck
            for edge in path:
                edge.residual_capacity -= bottleneck
                edge.flow += bottleneck
                if edge.rev:
                    edge.rev.residual_capacity += bottleneck
                    edge.rev.flow -= bottleneck

        return total_flow

    def edmonds_karp_with_trace(
        self,
        source: int,
        sink: int,
        id_to_key: dict[int, str],
        nodes_dict: dict[str, GraphNode],
        tracked_edges: list[tuple[FlowEdge, dict[str, Any]]],
    ) -> tuple[int, NetworkFlowGraphTrace]:
        """Executes Edmonds-Karp maximum flow algorithm and records step-by-step trace."""
        def make_snapshot(active_path_edges: set[str]) -> list[GraphEdgeSnapshot]:
            snapshots: list[GraphEdgeSnapshot] = []
            for edge, meta in tracked_edges:
                u_key = id_to_key[edge.u]
                v_key = id_to_key[edge.v]
                e_id = f"{u_key}->{v_key}"
                snapshots.append(
                    GraphEdgeSnapshot(
                        edge_id=e_id,
                        source=u_key,
                        target=v_key,
                        flow=edge.flow + edge.lower_bound,
                        capacity=edge.capacity,
                        lower_bound=edge.lower_bound,
                        residual_forward=edge.residual_capacity,
                        residual_backward=edge.rev.residual_capacity if edge.rev else 0,
                        in_augmenting_path=e_id in active_path_edges,
                        edge_type=meta.get("type", "STANDARD"),
                    )
                )
            return snapshots

        steps: list[GraphIterationStep] = []
        total_flow = 0

        # Step 0: Initial network state
        steps.append(
            GraphIterationStep(
                step_index=0,
                label="STEP 0: INITIAL CIRCULATION SETUP",
                description="Circulation network initialized with node balance demands d(v) = Inflow(LB) - Outflow(LB) and infinite return edge (T -> S).",
                bottleneck_flow=0,
                cumulative_flow=0,
                cumulative_cost_myr=0.0,
                augmenting_path_nodes=[],
                augmenting_path_edges=[],
                edges=make_snapshot(set()),
            )
        )

        step_idx = 1
        while True:
            bottleneck, path = self.bfs_find_path(source, sink)
            if bottleneck <= 0:
                break

            total_flow += bottleneck
            for edge in path:
                edge.residual_capacity -= bottleneck
                edge.flow += bottleneck
                if edge.rev:
                    edge.rev.residual_capacity += bottleneck
                    edge.rev.flow -= bottleneck

            # path is from sink to source, reverse to source -> sink
            fwd_path = list(reversed(path))
            path_nodes = [id_to_key[fwd_path[0].u]] + [id_to_key[e.v] for e in fwd_path]
            path_edges = [f"{id_to_key[e.u]}->{id_to_key[e.v]}" for e in fwd_path]
            path_labels = [nodes_dict[k].short_label for k in path_nodes if k in nodes_dict]

            steps.append(
                GraphIterationStep(
                    step_index=step_idx,
                    label=f"STEP {step_idx}: AUGMENT +{bottleneck} UNITS",
                    description=f"Augmenting path found: {' -> '.join(path_labels)}. Bottleneck capacity: {bottleneck} units. Cumulative circulation flow: {total_flow} units.",
                    bottleneck_flow=bottleneck,
                    cumulative_flow=total_flow,
                    cumulative_cost_myr=0.0,
                    augmenting_path_nodes=path_nodes,
                    augmenting_path_edges=path_edges,
                    edges=make_snapshot(set(path_edges)),
                )
            )
            step_idx += 1

        trace = NetworkFlowGraphTrace(
            graph_type="CIRCULATION_DEMANDS",
            nodes=list(nodes_dict.values()),
            steps=steps,
        )
        return total_flow, trace


def solve_network_flow(
    warehouses: list[Warehouse],
    stores: list[Store],
) -> Stage3Result:
    """Stage 3: Multi-Commodity Network Flow via Circulation with Demands & Bounds."""
    # 1. Run Stage 2 to obtain topological reachability & intermodal paths
    stage2 = evaluate_reachability(warehouses, stores)

    wh_map = {w.warehouse_id: w for w in warehouses}
    st_map = {s.store_id: s for s in stores}

    # Map each warehouse and store to its connected land component ID
    node_to_comp: dict[int, int] = {}
    for comp in stage2.components:
        for wid in comp.warehouse_ids:
            node_to_comp[wid] = comp.component_id
        for sid in comp.store_ids:
            node_to_comp[1000 + sid] = comp.component_id

    # 2. Assign unique integer IDs for the 5-layer network flow graph
    node_indexer: dict[str, int] = {}

    def get_node_id(key: str) -> int:
        if key not in node_indexer:
            node_indexer[key] = len(node_indexer)
        return node_indexer[key]

    S_ORIG = get_node_id("ORIG_SOURCE")
    T_ORIG = get_node_id("ORIG_SINK")

    # Raw demand edges to record for circulation reduction
    raw_edges: list[tuple[str, str, int, int, dict[str, Any]]] = []

    total_demand_requested = 0

    # A. Super-Source to Warehouses
    for w in warehouses:
        w_node = f"WH_{w.warehouse_id}"
        total_wh_stock = sum(w.inventory.values())
        raw_edges.append((
            "ORIG_SOURCE",
            w_node,
            total_wh_stock,
            0,
            {"type": "WH_INTAKE", "warehouse_id": w.warehouse_id},
        ))

        # Warehouse to Warehouse-Product Layer
        for pid, qty in w.inventory.items():
            wp_node = f"WH_{w.warehouse_id}_PROD_{pid}"
            raw_edges.append((
                w_node,
                wp_node,
                qty,
                0,
                {"type": "WH_STOCK", "warehouse_id": w.warehouse_id, "product_id": pid},
            ))

    # B. Stores and Store-Products
    for s in stores:
        s_node = f"STORE_{s.store_id}"
        total_st_demand = sum(s.requests.values())
        total_demand_requested += total_st_demand

        # Store to Super-Sink
        raw_edges.append((
            s_node,
            "ORIG_SINK",
            total_st_demand,
            0,
            {"type": "STORE_OUTFLOW", "store_id": s.store_id},
        ))

        # Store-Product to Store with LOWER BOUND = REQUEST (Non-negotiable demand!)
        for pid, req in s.requests.items():
            sp_node = f"STORE_{s.store_id}_PROD_{pid}"
            raw_edges.append((
                sp_node,
                s_node,
                req,
                req,  # Lower bound = exact store requirement!
                {"type": "STORE_DEMAND_LB", "store_id": s.store_id, "product_id": pid, "req": req},
            ))

            # Connect available warehouse supplies to this Store-Product node
            s_comp = node_to_comp.get(1000 + s.store_id)

            for w in warehouses:
                if pid not in w.inventory or w.inventory[pid] <= 0:
                    continue

                w_comp = node_to_comp.get(w.warehouse_id)
                wp_node = f"WH_{w.warehouse_id}_PROD_{pid}"

                if w_comp == s_comp:
                    # Same landmass: direct highway freight corridor
                    raw_edges.append((
                        wp_node,
                        sp_node,
                        min(w.inventory[pid], req),
                        0,
                        {
                            "type": "TRANSPORT_LAND",
                            "source_id": w.warehouse_id,
                            "target_id": s.store_id,
                            "product_id": pid,
                            "modality": Modality.LAND,
                        },
                    ))
                else:
                    # Cross-island: Intermodal sea transport via port gateways
                    dep_port = next((p for p in warehouses if p.is_port and node_to_comp.get(p.warehouse_id) == w_comp), None)
                    arr_port = next((p for p in warehouses if p.is_port and node_to_comp.get(p.warehouse_id) == s_comp), None)

                    if dep_port and arr_port:
                        port_dep_node = f"PORT_DEP_{dep_port.warehouse_id}_PROD_{pid}"
                        port_arr_node = f"PORT_ARR_{arr_port.warehouse_id}_PROD_{pid}"

                        raw_edges.append((
                            wp_node,
                            port_dep_node,
                            w.inventory[pid],
                            0,
                            {"type": "PORT_FEEDER_LAND", "product_id": pid},
                        ))
                        raw_edges.append((
                            port_dep_node,
                            port_arr_node,
                            100,  # Regional feeder container vessel slot limit
                            0,
                            {
                                "type": "TRANSPORT_MARITIME",
                                "source_id": w.warehouse_id,
                                "target_id": s.store_id,
                                "departure_port_id": dep_port.warehouse_id,
                                "arrival_port_id": arr_port.warehouse_id,
                                "product_id": pid,
                                "modality": Modality.MARITIME,
                            },
                        ))
                        raw_edges.append((
                            port_arr_node,
                            sp_node,
                            req,
                            0,
                            {"type": "PORT_LAST_MILE", "product_id": pid},
                        ))

    # Pre-register all node names into integer mapping
    for u_name, v_name, _, _, _ in raw_edges:
        get_node_id(u_name)
        get_node_id(v_name)

    # Add Circulation Return Edge: (ORIG_SINK -> ORIG_SOURCE) with infinite capacity
    raw_edges.append((
        "ORIG_SINK",
        "ORIG_SOURCE",
        1000000,
        0,
        {"type": "CIRCULATION_RETURN"},
    ))

    # 3. Construct Circulation Network with Lower Bounds Reduction
    # S* (Super-Source) and T* (Super-Sink)
    S_STAR = get_node_id("SUPER_SOURCE_STAR")
    T_STAR = get_node_id("SUPER_SINK_STAR")

    num_nodes = len(node_indexer)
    graph = ResidualNetwork(num_nodes)

    # Compute node demand balance vector d(v) = inflow(LB) - outflow(LB)
    node_demands: dict[int, int] = defaultdict(int)
    tracked_edges: list[tuple[FlowEdge, dict[str, Any]]] = []

    for u_name, v_name, cap, lb, meta in raw_edges:
        u = node_indexer[u_name]
        v = node_indexer[v_name]

        # Inflow to v increases by lb; Outflow from u increases by lb
        node_demands[v] += lb
        node_demands[u] -= lb

        # Edge in modified residual network has capacity = cap - lb
        edge = graph.add_edge(u, v, capacity=cap, lower_bound=lb, meta=meta)
        tracked_edges.append((edge, meta))

    # Connect S* and T* to balance demands
    target_lower_bound_flow = 0
    for node_id, demand in node_demands.items():
        if demand > 0:
            e = graph.add_edge(S_STAR, node_id, capacity=demand, lower_bound=0, meta={"type": "SUPER_SOURCE_BALANCE"})
            tracked_edges.append((e, {"type": "SUPER_SOURCE_BALANCE"}))
            target_lower_bound_flow += demand
        elif demand < 0:
            e = graph.add_edge(node_id, T_STAR, capacity=-demand, lower_bound=0, meta={"type": "SUPER_SINK_BALANCE"})
            tracked_edges.append((e, {"type": "SUPER_SINK_BALANCE"}))

    # Build complete node metadata dictionary for graph visualization
    nodes_dict: dict[str, GraphNode] = {
        "SUPER_SOURCE_STAR": GraphNode(
            node_id="SUPER_SOURCE_STAR",
            short_label="S*",
            layer=0,
            node_type="SUPER_SOURCE",
            title="Circulation Super-Source S*",
            metadata={"role": "Injects lower-bound demand offsets d(v) > 0 into the circulation network."},
        ),
        "ORIG_SOURCE": GraphNode(
            node_id="ORIG_SOURCE",
            short_label="S",
            layer=1,
            node_type="SOURCE",
            title="Original Network Supply Source",
            metadata={"role": "Supplies available inventory to regional distribution warehouses."},
        ),
    }

    # Warehouses & Warehouse Products
    for w in warehouses:
        w_key = f"WH_{w.warehouse_id}"
        nodes_dict[w_key] = GraphNode(
            node_id=w_key,
            short_label=f"W{w.warehouse_id}",
            layer=2,
            node_type="WAREHOUSE",
            title=f"Warehouse W{w.warehouse_id}: {w.name}",
            metadata={
                "name": w.name,
                "is_port": w.is_port,
                "total_stock": sum(w.inventory.values()),
                "inventory": w.inventory,
            },
        )
        for pid, qty in w.inventory.items():
            wp_key = f"WH_{w.warehouse_id}_PROD_{pid}"
            nodes_dict[wp_key] = GraphNode(
                node_id=wp_key,
                short_label=f"(W{w.warehouse_id},P{pid})",
                layer=3,
                node_type="WH_PRODUCT",
                title=f"Warehouse W{w.warehouse_id} Stock: P{pid}",
                metadata={
                    "warehouse": w.name,
                    "product_id": pid,
                    "available_units": qty,
                },
            )

    # Port Gateways
    for dep_port in warehouses:
        if dep_port.is_port:
            for pid in ["0", "1", "2"]:
                dep_key = f"PORT_DEP_{dep_port.warehouse_id}_PROD_{pid}"
                arr_key = f"PORT_ARR_{dep_port.warehouse_id}_PROD_{pid}"
                if any(u == dep_key or v == dep_key for u, v, _, _, _ in raw_edges):
                    nodes_dict[dep_key] = GraphNode(
                        node_id=dep_key,
                        short_label=f"(Dep-W{dep_port.warehouse_id},P{pid})",
                        layer=4,
                        node_type="PORT_GATEWAY",
                        title=f"Port Departure Berth: {dep_port.name} (P{pid})",
                        metadata={"port_name": dep_port.name, "product_id": pid, "berth": "DEPARTURE"},
                    )
                if any(u == arr_key or v == arr_key for u, v, _, _, _ in raw_edges):
                    nodes_dict[arr_key] = GraphNode(
                        node_id=arr_key,
                        short_label=f"(Arr-W{dep_port.warehouse_id},P{pid})",
                        layer=4,
                        node_type="PORT_GATEWAY",
                        title=f"Port Arrival Berth: {dep_port.name} (P{pid})",
                        metadata={"port_name": dep_port.name, "product_id": pid, "berth": "ARRIVAL"},
                    )

    # Store Products & Stores
    for s in stores:
        for pid, req in s.requests.items():
            sp_key = f"STORE_{s.store_id}_PROD_{pid}"
            nodes_dict[sp_key] = GraphNode(
                node_id=sp_key,
                short_label=f"(S{s.store_id},P{pid})",
                layer=5,
                node_type="STORE_PRODUCT",
                title=f"Store S{s.store_id} Request: P{pid}",
                metadata={
                    "store": s.name,
                    "product_id": pid,
                    "demand_units": req,
                },
            )
        s_key = f"STORE_{s.store_id}"
        nodes_dict[s_key] = GraphNode(
            node_id=s_key,
            short_label=f"S{s.store_id}",
            layer=6,
            node_type="STORE",
            title=f"Store S{s.store_id}: {s.name}",
            metadata={
                "name": s.name,
                "total_demand": sum(s.requests.values()),
                "requests": s.requests,
            },
        )

    # Sink & Super-Sink
    nodes_dict["ORIG_SINK"] = GraphNode(
        node_id="ORIG_SINK",
        short_label="T",
        layer=7,
        node_type="SINK",
        title="Original Demand Sink T",
        metadata={"role": "Collects satisfied retail store demands."},
    )
    nodes_dict["SUPER_SINK_STAR"] = GraphNode(
        node_id="SUPER_SINK_STAR",
        short_label="T*",
        layer=8,
        node_type="SUPER_SINK",
        title="Circulation Super-Sink T*",
        metadata={"role": "Absorbs negative demand deficits d(v) < 0 to balance circulation."},
    )

    id_to_key = {v: k for k, v in node_indexer.items()}

    # 4. Execute Edmonds-Karp on the transformed circulation network
    max_flow, graph_trace = graph.edmonds_karp_with_trace(
        S_STAR, T_STAR, id_to_key, nodes_dict, tracked_edges
    )
    is_feasible = max_flow == target_lower_bound_flow

    # 5. Extract Allocations and Reconstruct True Flows f(e) = f_res(e) + L(e)
    allocations: list[AllocationItem] = []
    total_satisfied = 0
    alloc_id_counter = 1

    corridor_flows: dict[str, dict[str, Any]] = defaultdict(lambda: {"flow": 0, "cap": 0, "mod": Modality.LAND})

    for edge, meta in tracked_edges:
        edge_type = meta.get("type")
        actual_flow = edge.flow + edge.lower_bound

        if edge_type == "TRANSPORT_LAND" and actual_flow > 0:
            wid = meta["source_id"]
            sid = meta["target_id"]
            pid = meta["product_id"]
            w = wh_map[wid]
            s = st_map[sid]

            pts, dist, mod = get_corridor_waypoints(
                w.name, s.name, (w.latitude, w.longitude), (s.latitude, s.longitude)
            )

            allocations.append(
                AllocationItem(
                    allocation_id=f"ALLOC-{alloc_id_counter:03d}",
                    source_id=wid,
                    source_name=w.name,
                    target_id=sid,
                    target_name=s.name,
                    product_id=str(pid),
                    quantity=actual_flow,
                    modality=Modality.LAND,
                    route_type=RouteType.DIRECT_HIGHWAY,
                    distance_km=dist,
                    transit_hours=round(dist / 65.0, 1),
                    path_coordinates=pts,
                    status=AllocationStatus.ALLOCATED,
                )
            )
            alloc_id_counter += 1
            total_satisfied += actual_flow

            corridor_key = f"{w.name} -> {s.name}"
            corridor_flows[corridor_key]["flow"] += actual_flow
            corridor_flows[corridor_key]["cap"] = max(corridor_flows[corridor_key]["cap"], 50)
            corridor_flows[corridor_key]["mod"] = Modality.LAND

        elif edge_type == "TRANSPORT_MARITIME" and actual_flow > 0:
            wid = meta["source_id"]
            sid = meta["target_id"]
            pid = meta["product_id"]
            dep_id = meta["departure_port_id"]
            arr_id = meta["arrival_port_id"]

            w = wh_map[wid]
            s = st_map[sid]
            dep_port = wh_map[dep_id]
            arr_port = wh_map[arr_id]

            allocations.append(
                AllocationItem(
                    allocation_id=f"ALLOC-{alloc_id_counter:03d}",
                    source_id=wid,
                    source_name=w.name,
                    target_id=sid,
                    target_name=s.name,
                    product_id=str(pid),
                    quantity=actual_flow,
                    modality=Modality.MARITIME,
                    route_type=RouteType.INTERMODAL_TRANSSHIPMENT,
                    distance_km=1510.4,
                    transit_hours=47.2,
                    departure_port_name=dep_port.name,
                    arrival_port_name=arr_port.name,
                    path_coordinates=MARITIME_PENANG_TO_KUCHING_WAYPOINTS,
                    status=AllocationStatus.ALLOCATED,
                )
            )
            alloc_id_counter += 1
            total_satisfied += actual_flow

            corridor_key = f"{dep_port.name} -> {arr_port.name} (Sea Lane)"
            corridor_flows[corridor_key]["flow"] += actual_flow
            corridor_flows[corridor_key]["cap"] = 100  # Regional feeder container vessel capacity
            corridor_flows[corridor_key]["mod"] = Modality.MARITIME

    # 6. Detailed Causal Bottleneck Traceability
    # For every store and requested product, check requested vs delivered
    store_prod_delivered: dict[tuple[int, str], int] = defaultdict(int)
    for alloc in allocations:
        store_prod_delivered[(alloc.target_id, alloc.product_id)] += alloc.quantity

    # Track inventory consumed per warehouse per product
    wh_prod_consumed: dict[tuple[int, str], int] = defaultdict(int)
    for alloc in allocations:
        wh_prod_consumed[(alloc.source_id, alloc.product_id)] += alloc.quantity

    bottleneck_details: list[BottleneckDetail] = []
    b_counter = 1
    tokens: list[str] = []
    bottlenecks: list[str] = []

    for s in stores:
        for pid, req_qty in s.requests.items():
            delivered = store_prod_delivered[(s.store_id, str(pid))]
            if delivered < req_qty:
                shortfall = req_qty - delivered
                s_comp = node_to_comp.get(1000 + s.store_id)

                # Trace supply depletion across reachable warehouses
                reachable_whs = [
                    w for w in warehouses
                    if pid in w.inventory and (
                        node_to_comp.get(w.warehouse_id) == s_comp or
                        w.is_port or
                        any(p.is_port for p in warehouses if node_to_comp.get(p.warehouse_id) == node_to_comp.get(w.warehouse_id))
                    )
                ]

                contributing_traces: list[str] = []
                total_reachable_supply = 0
                for w in reachable_whs:
                    w_stock = w.inventory[pid]
                    used = wh_prod_consumed[(w.warehouse_id, str(pid))]
                    total_reachable_supply += w_stock
                    contributing_traces.append(f"{w.name} (W{w.warehouse_id}): {used}/{w_stock} units used")

                if total_reachable_supply < req_qty:
                    b_type = BottleneckType.SUPPLY_EXHAUSTION
                    explanation = (
                        f"Supply Exhaustion: Total available supply of Product P{pid} across all reachable warehouses "
                        f"is {total_reachable_supply} units, which cannot satisfy Store S{s.store_id} ({s.name}) request of {req_qty} units. "
                        f"Shortfall = {shortfall} units. All contributing warehouse stocks are 100% depleted."
                    )
                else:
                    b_type = BottleneckType.CORRIDOR_SATURATION
                    explanation = (
                        f"Corridor Throughput Saturation: Product P{pid} has warehouse stock, but transport throughput caps "
                        f"or port fairway limits prevented routing {shortfall} units to Store S{s.store_id} ({s.name})."
                    )

                b_detail = BottleneckDetail(
                    bottleneck_id=f"BOTTLENECK-{b_counter:03d}",
                    product_id=str(pid),
                    store_id=s.store_id,
                    store_name=s.name,
                    requested_units=req_qty,
                    allocated_units=delivered,
                    shortfall_units=shortfall,
                    bottleneck_type=b_type,
                    root_cause=explanation,
                    contributing_warehouses=contributing_traces,
                )
                bottleneck_details.append(b_detail)
                b_counter += 1

                trace_token = (
                    f"[FAIL: BOTTLENECK TRACE] Store S{s.store_id} ({s.name}) Product P{pid} shortfall: "
                    f"Requested = {req_qty}, Delivered = {delivered}, Shortfall = {shortfall} units. "
                    f"Causal Chain: {', '.join(contributing_traces)} -> Stock fully exhausted."
                )
                tokens.append(trace_token)
                bottlenecks.append(trace_token)

                # Insert visible SHORTFALL item in dispatches list
                allocations.append(
                    AllocationItem(
                        allocation_id=f"SHORTFALL-P{pid}",
                        source_id=-1,
                        source_name="UNFULFILLED SHORTFALL",
                        target_id=s.store_id,
                        target_name=s.name,
                        product_id=str(pid),
                        quantity=shortfall,
                        modality=Modality.LAND,
                        route_type=RouteType.DIRECT_HIGHWAY,
                        distance_km=0.0,
                        transit_hours=0.0,
                        path_coordinates=[],
                        status=AllocationStatus.SHORTFALL,
                    )
                )

    # 7. Corridor Utilizations
    utilizations: list[FlowEdgeUtilization] = []
    for c_name, data in corridor_flows.items():
        flow_u = data["flow"]
        cap_u = max(data["cap"], flow_u)
        pct = round((flow_u / cap_u) * 100.0, 1) if cap_u > 0 else 0.0
        utilizations.append(
            FlowEdgeUtilization(
                corridor_name=c_name,
                modality=data["mod"],
                capacity_units=cap_u,
                flow_units=flow_u,
                utilization_pct=pct,
                is_saturated=flow_u >= cap_u,
            )
        )

    if is_feasible:
        tokens.append(
            f"[OK: FLOW SATISFIED] All retail requests fully met ({total_demand_requested} units across {len(allocations)} shipment flows)."
        )
        for alloc in allocations:
            if alloc.route_type == RouteType.INTERMODAL_TRANSSHIPMENT:
                tokens.append(
                    f"[INFO: INTERMODAL ALLOCATED] {alloc.quantity} units P{alloc.product_id} dispatched from {alloc.source_name} "
                    f"via {alloc.departure_port_name} -> {alloc.arrival_port_name} to {alloc.target_name} [SEA FAIRWAY: 1,510 km]."
                )
            else:
                tokens.append(
                    f"[OK: HIGHWAY ALLOCATED] {alloc.quantity} units P{alloc.product_id} from {alloc.source_name} to {alloc.target_name} "
                    f"via E1/Highway ({alloc.distance_km} km)."
                )

    pct_satisfied = round((total_satisfied / total_demand_requested) * 100.0, 1) if total_demand_requested > 0 else 100.0

    summary = (
        f"[VERIFIED: FLOW OPTIMAL] Feasible circulation established. {total_satisfied}/{total_demand_requested} units allocated ({pct_satisfied}% satisfaction rate)."
        if is_feasible
        else f"[FAIL: CIRCULATION BOTTLENECK] Flow deficit detected. Shortfall of {total_demand_requested - total_satisfied} units across retail demand bounds."
    )

    return Stage3Result(
        is_flow_feasible=is_feasible,
        total_demand_satisfied=total_satisfied,
        total_demand_requested=total_demand_requested,
        satisfaction_rate_pct=pct_satisfied,
        allocations=allocations,
        corridor_utilizations=utilizations,
        bottlenecks=bottlenecks,
        bottleneck_details=bottleneck_details,
        tokens=tokens,
        summary=summary,
        graph_trace=graph_trace,
    )
