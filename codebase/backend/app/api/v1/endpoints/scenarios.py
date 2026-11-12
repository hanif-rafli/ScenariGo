"""API endpoints for Scenario and Master Organization persistence."""

from fastapi import APIRouter, HTTPException, status

from app.db.database import (
    activate_scenario,
    create_scenario,
    delete_scenario,
    get_active_scenario,
    get_scenario,
    list_scenarios,
    reset_preset_scenario,
    update_scenario,
)
from app.models.responses import ScenarioSummary, SimulationRequest

router = APIRouter()


@router.get(
    "",
    response_model=list[ScenarioSummary],
    summary="List all scenarios",
    description="Returns all preset and custom scenarios stored in SQLite with active indicators.",
)
def get_all_scenarios() -> list[ScenarioSummary]:
    return list_scenarios()


@router.get(
    "/active",
    response_model=SimulationRequest,
    summary="Get active scenario",
    description="Returns the currently active scenario.",
)
def get_current_active_scenario() -> SimulationRequest:
    return get_active_scenario()


@router.get(
    "/{scenario_id}",
    response_model=SimulationRequest,
    summary="Get scenario by ID",
    description="Fetches full scenario payload by scenario ID.",
)
def get_single_scenario(scenario_id: str) -> SimulationRequest:
    scen = get_scenario(scenario_id)
    if not scen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Scenario '{scenario_id}' not found."
        )
    return scen


@router.post(
    "",
    response_model=SimulationRequest,
    status_code=status.HTTP_201_CREATED,
    summary="Create custom scenario",
    description="Saves a new custom scenario to SQLite and marks it active.",
)
def post_new_scenario(scenario: SimulationRequest) -> SimulationRequest:
    return create_scenario(scenario)


@router.put(
    "/{scenario_id}",
    response_model=SimulationRequest,
    summary="Update scenario",
    description="Updates an existing scenario's warehouses, stores, products, fleet, or budget.",
)
def put_update_scenario(scenario_id: str, scenario: SimulationRequest) -> SimulationRequest:
    existing = get_scenario(scenario_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Scenario '{scenario_id}' not found."
        )
    return update_scenario(scenario_id, scenario)


@router.post(
    "/{scenario_id}/activate",
    response_model=SimulationRequest,
    summary="Activate scenario",
    description="Sets the given scenario as the active scenario for the application.",
)
def post_activate_scenario(scenario_id: str) -> SimulationRequest:
    try:
        return activate_scenario(scenario_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.post(
    "/{scenario_id}/reset",
    response_model=SimulationRequest,
    summary="Reset preset scenario",
    description="Restores a factory preset scenario back to its original baseline state.",
)
def post_reset_preset(scenario_id: str) -> SimulationRequest:
    try:
        return reset_preset_scenario(scenario_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.delete(
    "/{scenario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete custom scenario",
    description="Deletes a custom scenario. Built-in factory presets cannot be deleted.",
)
def delete_single_scenario(scenario_id: str):
    try:
        deleted = delete_scenario(scenario_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Scenario '{scenario_id}' not found."
            )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
