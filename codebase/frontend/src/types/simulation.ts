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

// Stage 3: Multi-Commodity Network Flow Models
export type AllocationStatus = 'ALLOCATED' | 'SHORTFALL' | 'BOTTLENECK';
export type RouteType = 'DIRECT_HIGHWAY' | 'INTERMODAL_TRANSSHIPMENT';
export type BottleneckType = 'SUPPLY_EXHAUSTION' | 'CORRIDOR_SATURATION' | 'UNREACHABLE_ISLAND';

export interface BottleneckDetail {
  bottleneck_id: string;
  product_id: string;
  store_id: number;
  store_name: string;
  requested_units: number;
  allocated_units: number;
  shortfall_units: number;
  bottleneck_type: BottleneckType;
  root_cause: string;
  contributing_warehouses: string[];
}

export interface AllocationItem {
  allocation_id: string;
  source_id: number;
  source_name: string;
  target_id: number;
  target_name: string;
  product_id: string;
  quantity: number;
  modality: Modality;
  route_type: RouteType;
  distance_km: number;
  transit_hours: number;
  departure_port_name?: string | null;
  arrival_port_name?: string | null;
  path_coordinates?: [number, number][];
  status: AllocationStatus;
}

export interface FlowEdgeUtilization {
  corridor_name: string;
  modality: Modality;
  capacity_units: number;
  flow_units: number;
  utilization_pct: number;
  is_saturated: boolean;
}

// Graph Visualization Trace Models
export interface GraphNode {
  node_id: string;
  short_label: string;
  layer: number;
  node_type: string;
  title: string;
  metadata: Record<string, any>;
}

export interface GraphEdgeSnapshot {
  edge_id: string;
  source: string;
  target: string;
  flow: number;
  capacity: number;
  lower_bound: number;
  residual_forward: number;
  residual_backward: number;
  cost_myr?: number | null;
  in_augmenting_path: boolean;
  edge_type: string;
}

export interface GraphIterationStep {
  step_index: number;
  label: string;
  description: string;
  bottleneck_flow: number;
  cumulative_flow: number;
  cumulative_cost_myr: number;
  augmenting_path_nodes: string[];
  augmenting_path_edges: string[];
  edges: GraphEdgeSnapshot[];
}

export interface NetworkFlowGraphTrace {
  graph_type: 'CIRCULATION_DEMANDS' | 'BIPARTITE_MIN_COST';
  nodes: GraphNode[];
  steps: GraphIterationStep[];
}

export interface Stage3Result {
  is_flow_feasible: boolean;
  total_demand_satisfied: number;
  total_demand_requested: number;
  satisfaction_rate_pct: number;
  allocations: AllocationItem[];
  corridor_utilizations: FlowEdgeUtilization[];
  bottlenecks: string[];
  bottleneck_details?: BottleneckDetail[];
  tokens: string[];
  summary: string;
  graph_trace?: NetworkFlowGraphTrace;
}

// Stage 4: Fleet Routing, Fuel Range & Budget Pacing
export type TripLegType = 'DEADHEAD_PICKUP' | 'HAUL_DELIVERY' | 'REFUEL_DETOUR';

export interface RefuelingStop {
  station_id: string;
  station_name: string;
  highway_name: string;
  coords: [number, number];
  liters_refueled: number;
  cost_myr: number;
}

export interface TripLeg {
  leg_type: TripLegType;
  origin_name: string;
  origin_coords: [number, number];
  destination_name: string;
  destination_coords: [number, number];
  distance_km: number;
  transit_hours: number;
  fuel_burned_liters: number;
  fuel_cost_myr: number;
  path_coordinates: [number, number][];
}

export interface DispatchItinerary {
  itinerary_id: string;
  truck_id: string;
  truck_name: string;
  truck_image: string;
  allocation_id: string;
  product_id: string;
  quantity_units: number;
  source_warehouse_id: number;
  source_warehouse_name: string;
  target_store_id: number;
  target_store_name: string;
  total_distance_km: number;
  total_transit_hours: number;
  total_fuel_liters: number;
  total_fuel_cost_myr: number;
  legs: TripLeg[];
  refueling_stops: RefuelingStop[];
  is_refueled: boolean;
  is_range_exceeded: boolean;
  status: string;
}

export interface TruckInstance {
  truck_id: string;
  name: string;
  model_id: string;
  image_url: string;
  payload_capacity_kg: number;
  fuel_economy_kmpl: number;
  fuel_tank_capacity_l: number;
  current_location_name: string;
  current_coords: [number, number];
  assigned_allocation_id?: string | null;
  is_assigned: boolean;
}

export interface Stage4Result {
  is_budget_feasible: boolean;
  total_fleet_fuel_cost_myr: number;
  total_maritime_cost_myr: number;
  total_transport_cost_myr: number;
  budget_cap_myr: number;
  budget_variance_myr: number;
  dispatched_trucks_count: number;
  unassigned_tasks_count: number;
  itineraries: DispatchItinerary[];
  available_trucks: TruckInstance[];
  tokens: string[];
  summary: string;
  graph_trace?: NetworkFlowGraphTrace;
}
