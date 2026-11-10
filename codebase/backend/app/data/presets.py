from app.models.entities import (
    Warehouse,
    Store,
    FleetConfig,
    TruckModel,
    EconomicParameters,
)
from app.models.responses import SimulationRequest


def get_bobs_stationery_preset() -> SimulationRequest:
    """Bob's Stationery Enterprise baseline dataset from specs/specs-overall.md."""
    warehouses = [
        Warehouse(
            warehouse_id=0,
            name="Kuala Lumpur Hub",
            latitude=3.1390,
            longitude=101.6869,
            is_port=False,
            inventory={"0": 50, "1": 30},
        ),
        Warehouse(
            warehouse_id=1,
            name="Penang Logistics Dep",
            latitude=5.4164,
            longitude=100.3327,
            is_port=True,
            inventory={"0": 20, "2": 40},
        ),
        Warehouse(
            warehouse_id=2,
            name="Kuching Transshipment",
            latitude=1.5533,
            longitude=110.3592,
            is_port=True,
            inventory={"1": 15},
        ),
    ]

    stores = [
        Store(
            store_id=0,
            name="Shah Alam Retail",
            latitude=3.0738,
            longitude=101.5183,
            requests={"0": 25, "1": 10},
        ),
        Store(
            store_id=1,
            name="Ipoh Supermarket",
            latitude=4.5975,
            longitude=101.0901,
            requests={"0": 15},
        ),
        Store(
            store_id=2,
            name="Kuching Central Mall",
            latitude=1.5300,
            longitude=110.3400,
            requests={"1": 20, "2": 10},
        ),
    ]

    fleet = FleetConfig(
        truck_models=[
            TruckModel(
                model_id="tata_ace",
                name="Tata Ace Gold",
                payload_capacity_kg=900,
                fuel_economy_kmpl=22.0,
                fuel_tank_capacity_l=26.0,
            ),
            TruckModel(
                model_id="three_ton_lorry",
                name="Isuzu 3-Ton Box Lorry",
                payload_capacity_kg=3500,
                fuel_economy_kmpl=8.5,
                fuel_tank_capacity_l=100.0,
            ),
        ],
        economic_parameters=EconomicParameters(
            fuel_price_myr_per_liter=2.05,
            intermodal_sea_base_fee_myr=450.0,
            intermodal_sea_per_kg_myr=0.85,
            default_budget_cap_myr=7000.0,
        ),
    )

    return SimulationRequest(
        scenario_name="Bob's Stationery Enterprise Baseline",
        warehouses=warehouses,
        stores=stores,
        fleet=fleet,
        budget_cap_myr=7000.0,
    )


def get_deficit_preset() -> SimulationRequest:
    """East Malaysia Stockout scenario triggering Stage 1 early cutoff."""
    preset = get_bobs_stationery_preset()
    preset.scenario_name = "East Malaysia Stockout Deficit"
    # Artificially raise P1 demand beyond total supply (total supply is 45)
    preset.stores[2].requests["1"] = 50
    return preset


def get_air_freight_preset() -> SimulationRequest:
    """Preset 3: Expedited Air Freight Transshipment (KLIA -> Kuching).
    
    Models an urgent East Malaysia replenishment where cross-strait cargo is
    airlifted via dedicated air cargo freighters between KLIA and Kuching Airport.
    """
    warehouses = [
        Warehouse(
            warehouse_id=0,
            name="Kuala Lumpur Hub (KLIA Air Cargo)",
            latitude=2.7456,
            longitude=101.7072,
            is_port=False,
            is_airport=True,
            inventory={"0": 50, "1": 30},
        ),
        Warehouse(
            warehouse_id=1,
            name="Penang Logistics Dep",
            latitude=5.4164,
            longitude=100.3327,
            is_port=True,
            is_airport=False,
            inventory={"0": 20, "2": 40},
        ),
        Warehouse(
            warehouse_id=2,
            name="Kuching Air Cargo Hub",
            latitude=1.4847,
            longitude=110.3472,
            is_port=False,
            is_airport=True,
            inventory={"1": 15},
        ),
    ]

    stores = [
        Store(
            store_id=0,
            name="Shah Alam Retail",
            latitude=3.0738,
            longitude=101.5183,
            requests={"0": 25, "1": 10},
        ),
        Store(
            store_id=1,
            name="Ipoh Supermarket",
            latitude=4.5975,
            longitude=101.0901,
            requests={"0": 15},
        ),
        Store(
            store_id=2,
            name="Kuching Central Mall",
            latitude=1.5300,
            longitude=110.3400,
            requests={"1": 20, "2": 10},
        ),
    ]

    fleet = FleetConfig(
        truck_models=[
            TruckModel(
                model_id="tata_ace",
                name="Tata Ace Gold",
                payload_capacity_kg=900,
                fuel_economy_kmpl=22.0,
                fuel_tank_capacity_l=26.0,
            ),
            TruckModel(
                model_id="three_ton_lorry",
                name="Isuzu 3-Ton Box Lorry",
                payload_capacity_kg=3500,
                fuel_economy_kmpl=8.5,
                fuel_tank_capacity_l=100.0,
            ),
        ],
        economic_parameters=EconomicParameters(
            fuel_price_myr_per_liter=2.05,
            intermodal_sea_base_fee_myr=450.0,
            intermodal_sea_per_kg_myr=0.85,
            intermodal_air_base_fee_myr=1200.0,
            intermodal_air_per_kg_myr=4.50,
            default_budget_cap_myr=9500.0,
        ),
    )

    return SimulationRequest(
        scenario_name="Expedited Air Freight Transshipment (KLIA -> Kuching)",
        warehouses=warehouses,
        stores=stores,
        fleet=fleet,
        budget_cap_myr=9500.0,
    )
