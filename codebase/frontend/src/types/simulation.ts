export interface Warehouse {
  warehouse_id: number;
  name: string;
  latitude: number;
  longitude: number;
  is_port: boolean;
  inventory: Record<string, number>;
}

export interface Store {
  store_id: number;
  name: string;
  latitude: number;
  longitude: number;
  requests: Record<string, number>;
}

export interface TruckModel {
  model_id: string;
  name: string;
  payload_capacity_kg: number;
  fuel_economy_kmpl: number;
  fuel_tank_capacity_l: number;
}

export interface EconomicParameters {
  fuel_price_myr_per_liter: number;
  intermodal_sea_base_fee_myr: number;
  intermodal_sea_per_kg_myr: number;
  default_budget_cap_myr: number;
}

export interface FleetConfig {
  truck_models: TruckModel[];
  economic_parameters: EconomicParameters;
}

export type FeasibilityStatus = 'FEASIBLE' | 'DEFICIT' | 'UNSTOCKED';

export interface FeasibilityToken {
  product_id: string;
  requested: number;
  available: number;
  deficit: number;
  status: FeasibilityStatus;
  token_text: string;
}

export interface Stage1Result {
  is_feasible: boolean;
  total_products_checked: number;
  total_requested_units: number;
  total_available_units: number;
  deficits_count: number;
  tokens: FeasibilityToken[];
  summary: string;
}

export interface SimulationRequest {
  scenario_name: string;
  warehouses: Warehouse[];
  stores: Store[];
  fleet?: FleetConfig;
  budget_cap_myr?: number;
}
