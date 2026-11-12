from enum import Enum

from pydantic import BaseModel, Field

from app.models.entities import FleetConfig, ProductItem, Store, Warehouse, get_default_products
from app.models.fleet import TruckInstance


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
    scenario_id: str | None = Field(default=None, description="Unique scenario ID")
    scenario_name: str = Field(default="Custom Scenario", description="Name of scenario")
    is_preset: bool = Field(
        default=False, description="Whether this scenario originated from a factory preset"
    )
    is_modified: bool = Field(
        default=False, description="Whether this scenario has modified attributes from baseline"
    )
    warehouses: list[Warehouse] = Field(..., min_length=1, description="List of warehouses")
    stores: list[Store] = Field(..., min_length=1, description="List of retail/store demand nodes")
    products: list[ProductItem] = Field(
        default_factory=get_default_products, description="Master product catalog"
    )
    fleet: FleetConfig | None = Field(
        default=None, description="Optional fleet and economic config"
    )
    budget_cap_myr: float | None = Field(
        default=None, description="Optional transport budget limit"
    )
    custom_fleet: list[TruckInstance] | None = Field(
        default=None, description="Optional active truck fleet"
    )


class ScenarioSummary(BaseModel):
    scenario_id: str
    scenario_name: str
    is_preset: bool
    is_modified: bool
    is_active: bool
    updated_at: str
    warehouse_count: int
    store_count: int
    budget_cap_myr: float
