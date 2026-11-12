from fastapi import APIRouter

from app.core.stage2_reachability import evaluate_reachability
from app.models.graph import Stage2Result
from app.models.responses import SimulationRequest

router = APIRouter()


@router.post(
    "",
    response_model=Stage2Result,
    summary="Stage 2 Topological Reachability & Subgraph Partitioning",
    description=(
        "Partitions the physical multi-modal network into land-connected subgraphs (Peninsular vs Borneo) "
        "via BFS, checks local component self-sufficiency, and identifies required intermodal maritime routes."
    ),
)
def evaluate_network_reachability(request: SimulationRequest) -> Stage2Result:
    return evaluate_reachability(
        warehouses=request.warehouses,
        stores=request.stores,
    )
