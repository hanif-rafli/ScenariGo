from typing import Any, Optional
from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    """Represents a node in a network flow visualization."""
    node_id: str
    short_label: str
    layer: int
    node_type: str
    title: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphEdgeSnapshot(BaseModel):
    """State of a directed edge at a specific iteration step."""
    edge_id: str
    source: str
    target: str
    flow: int
    capacity: int
    lower_bound: int = 0
    residual_forward: int = 0
    residual_backward: int = 0
    cost_myr: Optional[float] = None
    in_augmenting_path: bool = False
    edge_type: str = "STANDARD"


class GraphIterationStep(BaseModel):
    """A single augmentation or construction step in the flow timeline."""
    step_index: int
    label: str
    description: str
    bottleneck_flow: int = 0
    cumulative_flow: int = 0
    cumulative_cost_myr: float = 0.0
    augmenting_path_nodes: list[str] = Field(default_factory=list)
    augmenting_path_edges: list[str] = Field(default_factory=list)
    edges: list[GraphEdgeSnapshot] = Field(default_factory=list)


class NetworkFlowGraphTrace(BaseModel):
    """Complete network flow execution trace including topology and iteration steps."""
    graph_type: str  # CIRCULATION_DEMANDS | BIPARTITE_MIN_COST
    nodes: list[GraphNode] = Field(default_factory=list)
    steps: list[GraphIterationStep] = Field(default_factory=list)
