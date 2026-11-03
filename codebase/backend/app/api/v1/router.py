from fastapi import APIRouter
from app.api.v1.endpoints import feasibility, presets, reachability

api_router = APIRouter()
api_router.include_router(feasibility.router, prefix="/feasibility", tags=["Feasibility"])
api_router.include_router(presets.router, prefix="/presets", tags=["Presets"])
api_router.include_router(reachability.router, prefix="/reachability", tags=["Reachability"])
