from fastapi import APIRouter
from app.models.responses import SimulationRequest
from app.data.presets import (
    get_bobs_stationery_preset,
    get_deficit_preset,
    get_air_freight_preset,
)

router = APIRouter()


@router.get(
    "/bob-stationery",
    response_model=SimulationRequest,
    summary="Bob's Stationery Baseline Scenario",
    description="Loads the baseline Peninsular vs East Malaysia scenario described in specs.",
)
def get_baseline_scenario() -> SimulationRequest:
    return get_bobs_stationery_preset()


@router.get(
    "/deficit-sample",
    response_model=SimulationRequest,
    summary="Deficit Scenario (Stage 1 Cutoff Trigger)",
    description="Loads a scenario with demand exceeding aggregate supply to demonstrate early cutoff.",
)
def get_deficit_scenario() -> SimulationRequest:
    return get_deficit_preset()


@router.get(
    "/air-freight",
    response_model=SimulationRequest,
    summary="Expedited Air Freight Transshipment Scenario",
    description="Loads the expedited air cargo scenario connecting KLIA Cargo Hub to Kuching Air Cargo Hub.",
)
def get_air_freight_scenario() -> SimulationRequest:
    return get_air_freight_preset()
