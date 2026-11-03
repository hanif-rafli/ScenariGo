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

// Stage 2: Topological Reachability & Graph Models
export type Modality = 0 | 1 | 2; // 0: Land, 1: Maritime, 2: Air

export interface NetworkEdge {
  source_id: number;
  target_id: number;
  source_name: string;
  target_name: string;
  source_coords: [number, number];
  target_coords: [number, number];
  distance_km: number;
  modality: Modality;
  cost_per_kg_myr: number;
  base_fee_myr: number;
  transit_hours: number;
  is_active: boolean;
  path_coordinates?: [number, number][];
}

export interface ComponentInfo {
  component_id: number;
  name: string;
  warehouse_ids: number[];
  store_ids: number[];
  total_supply: Record<string, number>;
  total_demand: Record<string, number>;
  is_self_sufficient: boolean;
  unmet_demand: Record<string, number>;
}

export interface IntermodalRoute {
  source_warehouse_id: number;
  source_warehouse_name: string;
  departure_port_id: number;
  departure_port_name: string;
  arrival_port_id: number;
  arrival_port_name: string;
  target_store_id: number;
  target_store_name: string;
  product_id: string;
  quantity: number;
  sea_distance_km: number;
  sea_transit_hours: number;
  estimated_carrier_cost_myr: number;
  token_text: string;
  path_coordinates?: [number, number][];
}

export interface Stage2Result {
  components: ComponentInfo[];
  edges: NetworkEdge[];
  intermodal_routes: IntermodalRoute[];
  tokens: string[];
  summary: string;
}
