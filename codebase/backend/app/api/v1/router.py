from fastapi import APIRouter

from app.api.v1.endpoints import feasibility, fleet, flow, presets, reachability, scenarios

api_router = APIRouter()
api_router.include_router(feasibility.router, prefix="/feasibility", tags=["Feasibility"])
api_router.include_router(presets.router, prefix="/presets", tags=["Presets"])
api_router.include_router(scenarios.router, prefix="/scenarios", tags=["Scenarios"])
api_router.include_router(reachability.router, prefix="/reachability", tags=["Reachability"])
api_router.include_router(flow.router, prefix="/flow", tags=["Network Flow"])
api_router.include_router(fleet.router, prefix="/fleet", tags=["Fleet Routing"])
