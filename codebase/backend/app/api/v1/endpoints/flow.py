from fastapi import APIRouter
from app.models.responses import SimulationRequest
from app.models.flow import Stage3Result
from app.core.stage3_network_flow import solve_network_flow

router = APIRouter()


@router.post(
    "",
    response_model=Stage3Result,
    summary="Stage 3 Multi-Commodity Network Flow with Bounds",
    description=(
        "Computes the discrete commodity allocation matrix via Ford-Fulkerson circulation "
        "with lower bounds (Discrete Optimization Principles), ensuring non-negotiable retail demand constraints "
        "and identifying physical highway or maritime transshipment bottlenecks."
    ),
)
def evaluate_network_flow(request: SimulationRequest) -> Stage3Result:
    return solve_network_flow(
        warehouses=request.warehouses,
        stores=request.stores,
    )
