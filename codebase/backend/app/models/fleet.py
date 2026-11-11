from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from app.models.graph_trace import NetworkFlowGraphTrace


class TripLegType(str, Enum):
    DEADHEAD_PICKUP = "DEADHEAD_PICKUP"
    HAUL_DELIVERY = "HAUL_DELIVERY"
    REFUEL_DETOUR = "REFUEL_DETOUR"


class RefuelingStop(BaseModel):
    station_id: str
    station_name: str
    highway_name: str
    coords: tuple[float, float]
    liters_refueled: float
    cost_myr: float


class TripLeg(BaseModel):
    leg_type: TripLegType
    origin_name: str
    origin_coords: tuple[float, float]
    destination_name: str
    destination_coords: tuple[float, float]
    distance_km: float
    transit_hours: float
    fuel_burned_liters: float
    fuel_cost_myr: float
    path_coordinates: list[tuple[float, float]] = Field(default_factory=list)


class DispatchItinerary(BaseModel):
    itinerary_id: str
    truck_id: str
    truck_name: str
    truck_image: str
    allocation_id: str
    product_id: str
    quantity_units: int
    source_warehouse_id: int
    source_warehouse_name: str
    target_store_id: int
    target_store_name: str
    total_distance_km: float
    total_transit_hours: float
    total_fuel_liters: float
    total_fuel_cost_myr: float
    legs: list[TripLeg] = Field(default_factory=list)
    refueling_stops: list[RefuelingStop] = Field(default_factory=list)
    is_refueled: bool = False
    is_range_exceeded: bool = False
    status: str = Field(default="SCHEDULED")


class TruckInstance(BaseModel):
    truck_id: str
    name: str
    model_id: str
    image_url: str
    payload_capacity_kg: float = Field(gt=0)
    fuel_economy_kmpl: float = Field(gt=0)
    fuel_tank_capacity_l: float = Field(gt=0)
    current_location_name: str
    current_coords: tuple[float, float]
    assigned_allocation_id: Optional[str] = None
    is_assigned: bool = False
    is_custom: bool = False


class Stage4Result(BaseModel):
    is_budget_feasible: bool
    total_fleet_fuel_cost_myr: float
    total_maritime_cost_myr: float
    total_air_cost_myr: float = 0.0
    total_transport_cost_myr: float
    budget_cap_myr: float
    budget_variance_myr: float  # Positive = surplus/savings, Negative = overage
    dispatched_trucks_count: int
    unassigned_tasks_count: int
    itineraries: list[DispatchItinerary] = Field(default_factory=list)
    available_trucks: list[TruckInstance] = Field(default_factory=list)
    tokens: list[str] = Field(default_factory=list)
    summary: str
    graph_trace: Optional[NetworkFlowGraphTrace] = None
