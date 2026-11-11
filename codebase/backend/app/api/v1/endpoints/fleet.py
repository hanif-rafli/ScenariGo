from fastapi import APIRouter, HTTPException
from app.models.responses import SimulationRequest
from app.models.fleet import Stage4Result, TruckInstance
from app.core.stage3_network_flow import solve_network_flow
from app.core.stage4_fleet_routing import solve_fleet_routing, get_default_fleet

router = APIRouter()


@router.get("/trucks", response_model=list[TruckInstance])
async def get_truck_fleet() -> list[TruckInstance]:
    """Returns the commercial vehicle fleet available for dispatch."""
    return get_default_fleet([])


@router.post("/route", response_model=Stage4Result)
async def evaluate_fleet_routing(request: SimulationRequest) -> Stage4Result:
    """Executes Stage 4 Fleet Routing, Range Checking, and Budget Verification."""
    try:
        # 1. Run Stage 3 Network Flow to establish the commodity allocation matrix
        flow_res = solve_network_flow(
            warehouses=request.warehouses,
            stores=request.stores,
        )

        # 2. Run Stage 4 Fleet Routing & Budget Pacing
        econ_params = request.fleet.economic_parameters if request.fleet else None
        budget_cap = request.budget_cap_myr if request.budget_cap_myr is not None else (
            econ_params.default_budget_cap_myr if econ_params else 7000.0
        )
        stage4_res = solve_fleet_routing(
            allocations=flow_res.allocations,
            warehouses=request.warehouses,
            stores=request.stores,
            fleet=request.custom_fleet,
            budget_cap_myr=budget_cap,
            economic_parameters=econ_params,
            products=request.products,
        )
        return stage4_res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stage 4 Fleet Routing error: {str(e)}")
