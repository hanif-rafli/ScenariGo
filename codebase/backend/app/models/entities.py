from typing import Any
from pydantic import BaseModel, Field, field_validator


class ProductItem(BaseModel):
    product_id: str
    name: str
    sku: str
    category: str = "Stationery & Office Supplies"
    unit_weight_kg: float = Field(default=20.0, gt=0)
    low_stock_threshold: int = Field(default=15, ge=0)


def get_default_products() -> list[ProductItem]:
    return [
        ProductItem(
            product_id="0",
            name="A4 Copy Paper Ream Box",
            sku="PAP-A4-80G",
            category="Paper Supplies",
            unit_weight_kg=12.5,
            low_stock_threshold=20,
        ),
        ProductItem(
            product_id="1",
            name="Laser Toner Cartridge Crate",
            sku="TNR-BLK-CR8",
            category="Printing Consumables",
            unit_weight_kg=8.0,
            low_stock_threshold=15,
        ),
        ProductItem(
            product_id="2",
            name="Archival Lever-Arch Binder Case",
            sku="BND-LV-CS12",
            category="Filing & Storage",
            unit_weight_kg=15.0,
            low_stock_threshold=10,
        ),
    ]


class ProductStock(BaseModel):
    product_id: str
    quantity: int = Field(ge=0, description="Available product quantity (non-negative)")


class ProductDemand(BaseModel):
    product_id: str
    requested_qty: int = Field(ge=0, description="Requested product quantity (non-negative)")


class Warehouse(BaseModel):
    warehouse_id: int
    name: str
    latitude: float
    longitude: float
    is_port: bool = False
    is_airport: bool = False
    inventory: dict[str, int] = Field(
        default_factory=dict,
        description="Dictionary mapping product_id (as str) to available quantity",
    )

    @field_validator("inventory", mode="before")
    @classmethod
    def normalize_inventory(cls, v: Any) -> dict[str, int]:
        if isinstance(v, list):
            # Supports list of dicts: [{'product_id': '0', 'quantity': 50}]
            res: dict[str, int] = {}
            for item in v:
                if isinstance(item, dict):
                    pid = str(item.get("product_id"))
                    qty = int(item.get("quantity", 0))
                    res[pid] = res.get(pid, 0) + qty
            return res
        if isinstance(v, dict):
            return {str(k): int(val) for k, val in v.items()}
        return {}


class Store(BaseModel):
    store_id: int
    name: str
    latitude: float
    longitude: float
    requests: dict[str, int] = Field(
        default_factory=dict,
        description="Dictionary mapping product_id (as str) to requested quantity",
    )

    @field_validator("requests", mode="before")
    @classmethod
    def normalize_requests(cls, v: Any) -> dict[str, int]:
        if isinstance(v, list):
            # Supports list of dicts: [{'product_id': '0', 'requested_qty': 25}]
            res: dict[str, int] = {}
            for item in v:
                if isinstance(item, dict):
                    pid = str(item.get("product_id"))
                    qty = int(item.get("requested_qty", item.get("quantity", 0)))
                    res[pid] = res.get(pid, 0) + qty
            return res
        if isinstance(v, dict):
            return {str(k): int(val) for k, val in v.items()}
        return {}


class TruckModel(BaseModel):
    model_id: str
    name: str
    payload_capacity_kg: float = Field(gt=0)
    fuel_economy_kmpl: float = Field(gt=0, description="Fuel economy in km per liter")
    fuel_tank_capacity_l: float = Field(gt=0, description="Tank capacity in liters")


class EconomicParameters(BaseModel):
    fuel_price_myr_per_liter: float = Field(default=2.05, gt=0)
    intermodal_sea_base_fee_myr: float = Field(default=450.0, ge=0)
    intermodal_sea_per_kg_myr: float = Field(default=0.85, ge=0)
    intermodal_air_base_fee_myr: float = Field(default=1200.0, ge=0)
    intermodal_air_per_kg_myr: float = Field(default=4.50, ge=0)
    default_budget_cap_myr: float = Field(default=7000.0, gt=0)


class FleetConfig(BaseModel):
    truck_models: list[TruckModel] = Field(default_factory=list)
    economic_parameters: EconomicParameters = Field(default_factory=EconomicParameters)
