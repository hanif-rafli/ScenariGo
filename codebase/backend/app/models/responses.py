from enum import Enum
from pydantic import BaseModel, Field
from app.models.entities import Warehouse, Store, FleetConfig


class FeasibilityStatus(str, Enum):
    FEASIBLE = "FEASIBLE"
    DEFICIT = "DEFICIT"
    UNSTOCKED = "UNSTOCKED"


class FeasibilityToken(BaseModel):
    product_id: str
    requested: int
    available: int
    deficit: int
    status: FeasibilityStatus
    token_text: str


class Stage1Result(BaseModel):
    is_feasible: bool
    total_products_checked: int
    total_requested_units: int
    total_available_units: int
    deficits_count: int
    tokens: list[FeasibilityToken]
    summary: str


class SimulationRequest(BaseModel):
    scenario_name: str = Field(default="Custom Scenario", description="Name of scenario")
    warehouses: list[Warehouse] = Field(..., min_length=1, description="List of warehouses")
    stores: list[Store] = Field(..., min_length=1, description="List of retail/store demand nodes")
    fleet: FleetConfig | None = Field(default=None, description="Optional fleet and economic config")
    budget_cap_myr: float | None = Field(default=None, description="Optional transport budget limit")
