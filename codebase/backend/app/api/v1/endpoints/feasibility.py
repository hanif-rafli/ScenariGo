from fastapi import APIRouter

from app.core.stage1_feasibility import check_global_feasibility
from app.models.responses import SimulationRequest, Stage1Result

router = APIRouter()


@router.post(
    "",
    response_model=Stage1Result,
    summary="Stage 1 Global Inventory Feasibility Check",
    description=(
        "Executes O(N) early cutoff check comparing aggregate warehouse supply "
        "against store requests across all product commodities."
    ),
)
def evaluate_feasibility(request: SimulationRequest) -> Stage1Result:
    return check_global_feasibility(
        warehouses=request.warehouses,
        stores=request.stores,
    )
