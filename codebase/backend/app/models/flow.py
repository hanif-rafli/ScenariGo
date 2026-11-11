from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field
from app.models.graph import Modality
from app.models.graph_trace import NetworkFlowGraphTrace


class AllocationStatus(str, Enum):
    ALLOCATED = "ALLOCATED"
    SHORTFALL = "SHORTFALL"
    BOTTLENECK = "BOTTLENECK"


class RouteType(str, Enum):
    DIRECT_HIGHWAY = "DIRECT_HIGHWAY"
    INTERMODAL_TRANSSHIPMENT = "INTERMODAL_TRANSSHIPMENT"


class BottleneckType(str, Enum):
    SUPPLY_EXHAUSTION = "SUPPLY_EXHAUSTION"
    CORRIDOR_SATURATION = "CORRIDOR_SATURATION"
    VESSEL_SLOT_EXHAUSTION = "VESSEL_SLOT_EXHAUSTION"
    UNREACHABLE_ISLAND = "UNREACHABLE_ISLAND"


class BottleneckDetail(BaseModel):
    """Granular causal traceability for an unfulfilled demand bottleneck."""
    bottleneck_id: str
    product_id: str
    store_id: int
    store_name: str
    requested_units: int
    allocated_units: int
    shortfall_units: int
    bottleneck_type: BottleneckType
    root_cause: str
    contributing_warehouses: list[str] = Field(default_factory=list)


class AllocationItem(BaseModel):
    """Represents a discrete commodity shipment from a warehouse to a store."""
    allocation_id: str
    source_id: int
    source_name: str
    target_id: int
    target_name: str
    product_id: str
    quantity: int
    modality: Modality
    route_type: RouteType
    distance_km: float
    transit_hours: float
    departure_port_name: str | None = None
    arrival_port_name: str | None = None
    path_coordinates: list[tuple[float, float]] = Field(default_factory=list)
    status: AllocationStatus = AllocationStatus.ALLOCATED


class FlowEdgeUtilization(BaseModel):
    """Reports throughput utilization across critical highway and maritime logistics corridors."""
    corridor_name: str
    modality: Modality
    capacity_units: int
    flow_units: int
    utilization_pct: float
    is_saturated: bool


class Stage3Result(BaseModel):
    """Result of Stage 3 Multi-Commodity Network Flow (Ford-Fulkerson circulation with bounds)."""
    is_flow_feasible: bool
    total_demand_satisfied: int
    total_demand_requested: int
    satisfaction_rate_pct: float
    allocations: list[AllocationItem] = Field(default_factory=list)
    corridor_utilizations: list[FlowEdgeUtilization] = Field(default_factory=list)
    bottlenecks: list[str] = Field(default_factory=list)
    bottleneck_details: list[BottleneckDetail] = Field(default_factory=list)
    tokens: list[str] = Field(default_factory=list)
    summary: str
    graph_trace: Optional[NetworkFlowGraphTrace] = None
