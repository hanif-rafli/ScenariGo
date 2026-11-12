from enum import IntEnum

from pydantic import BaseModel, Field


class Modality(IntEnum):
    LAND = 0  # Highway / road network (truck traversable)
    MARITIME = 1  # Intermodal ocean shipping lane (port-to-port)
    AIR = 2  # Air freight corridor (airport-to-airport)


class NetworkEdge(BaseModel):
    source_id: int
    target_id: int
    source_name: str
    target_name: str
    source_coords: tuple[float, float]
    target_coords: tuple[float, float]
    distance_km: float = Field(gt=0, description="Transport distance in kilometers")
    modality: Modality = Modality.LAND
    cost_per_kg_myr: float = Field(default=0.0, ge=0)
    base_fee_myr: float = Field(default=0.0, ge=0)
    transit_hours: float = Field(default=0.0, ge=0)
    is_active: bool = True
    path_coordinates: list[tuple[float, float]] = Field(
        default_factory=list,
        description="Detailed GIS polyline coordinates [latitude, longitude] following real roads or shipping fairways",
    )


class ComponentInfo(BaseModel):
    component_id: int
    name: str
    warehouse_ids: list[int]
    store_ids: list[int]
    total_supply: dict[str, int]
    total_demand: dict[str, int]
    is_self_sufficient: bool
    unmet_demand: dict[str, int] = Field(default_factory=dict)


class IntermodalRoute(BaseModel):
    source_warehouse_id: int
    source_warehouse_name: str
    departure_port_id: int
    departure_port_name: str
    arrival_port_id: int
    arrival_port_name: str
    target_store_id: int
    target_store_name: str
    product_id: str
    quantity: int
    sea_distance_km: float
    sea_transit_hours: float
    estimated_carrier_cost_myr: float
    token_text: str
    modality: Modality = Modality.MARITIME
    path_coordinates: list[tuple[float, float]] = Field(
        default_factory=list,
        description="Navigational sea fairway or air corridor waypoints [latitude, longitude]",
    )


class Stage2Result(BaseModel):
    components: list[ComponentInfo]
    edges: list[NetworkEdge]
    intermodal_routes: list[IntermodalRoute]
    tokens: list[str]
    summary: str
