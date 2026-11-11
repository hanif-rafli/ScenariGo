import { useState, useEffect, useCallback, useRef } from 'react';
import { Header, AppView } from './components/Header';
import { MapView } from './components/MapView';
import { FeasibilityPanel } from './components/FeasibilityPanel';
import { ReachabilityPanel } from './components/ReachabilityPanel';
import { FlowPanel } from './components/FlowPanel';
import { FleetPanel } from './components/FleetPanel';
import { GraphView } from './pages/GraphView';
import { DashboardPage } from './pages/DashboardPage';
import { OrganizationPage } from './pages/OrganizationPage';
import {
  SimulationRequest,
  Stage1Result,
  Stage2Result,
  Stage3Result,
  Stage4Result,
  AllocationItem,
  TruckInstance,
  ScenarioSummary,
} from './types/simulation';
import {
  checkBackendHealth,
  fetchBobStationeryPreset,
  evaluateFeasibility,
  evaluateReachability,
  evaluateNetworkFlow,
  evaluateFleetRouting,
  fetchTruckFleet,
  fetchScenariosList,
  fetchActiveScenario,
  fetchScenarioById,
  activateScenario,
  resetPresetScenario,
  updateScenario,
} from './services/api';

const FALLBACK_BASELINE: SimulationRequest = {
  scenario_id: 'bob-stationery',
  scenario_name: "Bob's Stationery Enterprise Baseline (Local)",
  is_preset: true,
  is_modified: false,
  warehouses: [
    {
      warehouse_id: 0,
      name: 'Kuala Lumpur Hub',
      latitude: 3.139,
      longitude: 101.6869,
      is_port: false,
      inventory: { '0': 50, '1': 30 },
    },
    {
      warehouse_id: 1,
      name: 'Penang Logistics Dep',
      latitude: 5.4164,
      longitude: 100.3327,
      is_port: true,
      inventory: { '0': 20, '2': 40 },
    },
    {
      warehouse_id: 2,
      name: 'Kuching Transshipment',
      latitude: 1.5533,
      longitude: 110.3592,
      is_port: true,
      inventory: { '1': 15 },
    },
  ],
  stores: [
    {
      store_id: 0,
      name: 'Shah Alam Retail',
      latitude: 3.0738,
      longitude: 101.5183,
      requests: { '0': 25, '1': 10 },
    },
    {
      store_id: 1,
      name: 'Ipoh Supermarket',
      latitude: 4.5975,
      longitude: 101.0901,
      requests: { '0': 15 },
    },
    {
      store_id: 2,
      name: 'Kuching Central Mall',
      latitude: 1.53,
      longitude: 110.34,
      requests: { '1': 20, '2': 10 },
    },
  ],
  budget_cap_myr: 7000,
  products: [
    { product_id: '0', name: 'Premium Paper Cartons (A4)', sku: 'P0-PAPER-A4', category: 'Office Supplies', unit_weight_kg: 15.0, low_stock_threshold: 20 },
    { product_id: '1', name: 'Commercial Ink Cartridges', sku: 'P1-INK-CART', category: 'Office Supplies', unit_weight_kg: 2.5, low_stock_threshold: 15 },
    { product_id: '2', name: 'Archive Filing Cabinets', sku: 'P2-ARCH-CAB', category: 'Storage & Hardware', unit_weight_kg: 35.0, low_stock_threshold: 10 },
  ],
};

export function App() {
  const [scenario, setScenario] = useState<SimulationRequest>(FALLBACK_BASELINE);
  const [scenariosList, setScenariosList] = useState<ScenarioSummary[]>([]);
  const [feasibilityResult, setFeasibilityResult] = useState<Stage1Result | null>(null);
  const [reachabilityResult, setReachabilityResult] = useState<Stage2Result | null>(null);
  const [flowResult, setFlowResult] = useState<Stage3Result | null>(null);
  const [stage4Result, setStage4Result] = useState<Stage4Result | null>(null);
  const [fleet, setFleet] = useState<TruckInstance[]>([]);
  const fleetRef = useRef<TruckInstance[]>([]);
  fleetRef.current = fleet;

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [selectedAllocation, setSelectedAllocation] = useState<AllocationItem | null>(null);
  const [panTarget, setPanTarget] = useState<[number, number] | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<'stage1' | 'stage2' | 'stage3' | 'stage4'>('stage4');
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSelectStore = (storeId: number | string) => {
    const rawIdStr = String(storeId);
    const numericMatch = rawIdStr.match(/\d+/);
    const numericId = numericMatch ? parseInt(numericMatch[0], 10) : NaN;

    const store = scenario.stores.find(
      (s) => s.store_id === numericId || s.name.toLowerCase().includes(rawIdStr.toLowerCase())
    );
    if (store) {
      setPanTarget([store.latitude, store.longitude]);
      setActiveView('simulator');
    }
  };

  const handleSelectWarehouse = (warehouseId: number) => {
    const warehouse = scenario.warehouses.find((w) => w.warehouse_id === warehouseId);
    if (warehouse) {
      setPanTarget([warehouse.latitude, warehouse.longitude]);
      setActiveView('simulator');
    }
  };

  const runEvaluation = useCallback(async (targetScenario: SimulationRequest, currentFleet?: TruckInstance[]) => {
    setLoading(true);
    try {
      // 1. Stage 1 Global Feasibility Check
      const stage1 = await evaluateFeasibility(targetScenario);
      setFeasibilityResult(stage1);

      // 2. Stage 2 Reachability & Graph Partitioning Check
      const stage2 = await evaluateReachability(targetScenario);
      setReachabilityResult(stage2);

      // 3. Stage 3 Multi-Commodity Network Flow (Circulation with Bounds)
      const stage3 = await evaluateNetworkFlow(targetScenario);
      setFlowResult(stage3);

      // 4. Stage 4 Fleet Routing, Range Checking & Budget Pacing
      const activeFleet =
        currentFleet ??
        targetScenario.custom_fleet ??
        (fleetRef.current.length > 0 ? fleetRef.current : undefined);
      const fleetScenario: SimulationRequest = {
        ...targetScenario,
        custom_fleet: activeFleet,
      };
      const stage4 = await evaluateFleetRouting(fleetScenario);
      setStage4Result(stage4);
      if (stage4.available_trucks && stage4.available_trucks.length > 0) {
        setFleet((prev) => {
          const customTrucks = prev.filter((t) => t.is_custom);
          const returnedIds = new Set(stage4.available_trucks.map((t) => t.truck_id));
          const missingCustom = customTrucks.filter((t) => !returnedIds.has(t.truck_id));
          return [...stage4.available_trucks, ...missingCustom];
        });
      }
    } catch (err) {
      console.warn('Backend evaluation failed, evaluating locally in frontend:', err);
      // Fallback Stage 1 calculation
      const totalDemand: Record<string, number> = {};
      const totalSupply: Record<string, number> = {};

      for (const w of targetScenario.warehouses) {
        for (const [pid, qty] of Object.entries(w.inventory)) {
          totalSupply[pid] = (totalSupply[pid] || 0) + qty;
        }
      }

      for (const s of targetScenario.stores) {
        for (const [pid, qty] of Object.entries(s.requests)) {
          totalDemand[pid] = (totalDemand[pid] || 0) + qty;
        }
      }

      let deficitsCount = 0;
      const tokens = [];

      for (const [pid, req] of Object.entries(totalDemand)) {
        const avail = totalSupply[pid] || 0;
        if (avail < req) {
          deficitsCount++;
          tokens.push({
            product_id: pid,
            requested: req,
            available: avail,
            deficit: req - avail,
            status: (avail === 0 ? 'UNSTOCKED' : 'DEFICIT') as 'DEFICIT' | 'UNSTOCKED',
            token_text: `[FAIL: INVENTORY DEFICIT] Product P${pid} short by ${req - avail} units. Requested = ${req}, Available = ${avail} [INFEASIBLE]`,
          });
        } else {
          tokens.push({
            product_id: pid,
            requested: req,
            available: avail,
            deficit: 0,
            status: 'FEASIBLE' as const,
            token_text: `[OK: INVENTORY SATISFIED] Product P${pid}: Requested = ${req}, Available = ${avail} (Surplus = ${avail - req})`,
          });
        }
      }

      setFeasibilityResult({
        is_feasible: deficitsCount === 0,
        total_products_checked: Object.keys(totalDemand).length,
        total_requested_units: Object.values(totalDemand).reduce((a, b) => a + b, 0),
        total_available_units: Object.values(totalSupply).reduce((a, b) => a + b, 0),
        deficits_count: deficitsCount,
        tokens,
        summary:
          deficitsCount === 0
            ? `[VERIFIED: FEASIBLE] Global inventory satisfied across ${targetScenario.warehouses.length} warehouses for all products.`
            : `[FAIL: INVENTORY DEFICIT] ${deficitsCount} product(s) exhibit supply shortfalls. Simulation aborted at Stage 1 early cutoff.`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialization: check backend health and load active scenario from SQLite
  useEffect(() => {
    async function init() {
      const isOnline = await checkBackendHealth();
      setBackendOnline(isOnline);

      if (isOnline) {
        try {
          const [summaries, activeScen, initialFleet] = await Promise.all([
            fetchScenariosList(),
            fetchActiveScenario().catch(() => fetchBobStationeryPreset()),
            fetchTruckFleet().catch(() => []),
          ]);
          setScenariosList(summaries);
          setScenario(activeScen);
          if (initialFleet && initialFleet.length > 0) {
            setFleet(initialFleet);
          }
          await runEvaluation(activeScen, initialFleet);
          return;
        } catch (e) {
          console.error('Failed to fetch initial preset:', e);
        }
      }

      await runEvaluation(FALLBACK_BASELINE);
    }

    init();
  }, [runEvaluation]);

  // Scenario Activation (from Organization sub-tabs or Presets)
  const handleSelectScenario = async (scenarioId: string) => {
    setLoading(true);
    try {
      let target: SimulationRequest;
      if (backendOnline) {
        target = await activateScenario(scenarioId);
        const summaries = await fetchScenariosList();
        setScenariosList(summaries);
      } else {
        target = await fetchScenarioById(scenarioId);
      }
      setScenario(target);
      await runEvaluation(target, fleet);
    } catch (err) {
      console.error('Error activating scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  // Factory Reset
  const handleResetScenario = async (scenarioId: string) => {
    setLoading(true);
    try {
      let target: SimulationRequest;
      if (backendOnline) {
        target = await resetPresetScenario(scenarioId);
        const summaries = await fetchScenariosList();
        setScenariosList(summaries);
      } else {
        target = JSON.parse(JSON.stringify(FALLBACK_BASELINE));
      }
      setScenario(target);
      await runEvaluation(target, fleet);
    } catch (err) {
      console.error('Error resetting scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save changes (Warehouses, Stores, Products, Settings)
  const handleSaveScenario = async (updated: SimulationRequest) => {
    setLoading(true);
    try {
      let saved: SimulationRequest;
      const targetId = updated.scenario_id || 'bob-stationery';
      if (backendOnline) {
        saved = await updateScenario(targetId, updated);
        const summaries = await fetchScenariosList();
        setScenariosList(summaries);
      } else {
        saved = updated;
        localStorage.setItem(`scenarigo_scenario_${targetId}`, JSON.stringify(saved));
      }
      setScenario(saved);
      await runEvaluation(saved, fleet);
    } catch (err) {
      console.error('Error saving scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fleet management
  const handleAddTruck = (newTruck: TruckInstance) => {
    const updated = [...fleet, newTruck];
    setFleet(updated);
    const fleetScenario: SimulationRequest = {
      ...scenario,
      custom_fleet: updated,
    };
    evaluateFleetRouting(fleetScenario)
      .then((res) => setStage4Result(res))
      .catch((err) => console.warn('Failed to re-evaluate fleet with new truck:', err));
  };

  const handleDeleteTruck = (truckId: string) => {
    const updated = fleet.filter((t) => t.truck_id !== truckId);
    setFleet(updated);
    const fleetScenario: SimulationRequest = {
      ...scenario,
      custom_fleet: updated,
    };
    evaluateFleetRouting(fleetScenario)
      .then((res) => setStage4Result(res))
      .catch((err) => console.warn('Failed to re-evaluate fleet after truck deletion:', err));
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-mono selection:bg-white selection:text-black">
      <Header
        activeScenarioName={scenario.scenario_name}
        isModified={scenario.is_modified}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* VIEW 1: DASHBOARD VIEW */}
        {activeView === 'dashboard' && (
          <DashboardPage
            scenario={scenario}
            flowResult={flowResult}
            stage4Result={stage4Result}
            fleet={fleet}
            onSelectStore={handleSelectStore}
            onSelectWarehouse={handleSelectWarehouse}
          />
        )}

        {/* VIEW 2: ORGANIZATION VIEW */}
        {activeView === 'organization' && (
          <OrganizationPage
            scenario={scenario}
            scenariosList={scenariosList}
            fleet={fleet}
            itineraries={stage4Result?.itineraries ?? []}
            onSelectScenario={handleSelectScenario}
            onResetScenario={handleResetScenario}
            onSaveScenario={handleSaveScenario}
            onAddTruck={handleAddTruck}
            onDeleteTruck={handleDeleteTruck}
            onCustomScenarioLoaded={handleSaveScenario}
            loading={loading}
          />
        )}

        {/* VIEW 3: GRAPH VIEW */}
        {activeView === 'graph' && (
          <GraphView
            circulationTrace={flowResult?.graph_trace}
            bipartiteTrace={stage4Result?.graph_trace}
            loading={loading}
          />
        )}

        {/* VIEW 4: SIMULATOR VIEW */}
        {activeView === 'simulator' && (
          <>
            {/* Compact Execution Status Bar */}
            <div className="bg-neutral-950 p-3.5 border border-neutral-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-neutral-500 text-[10px] uppercase tracking-wider">
                    Active Scenario:
                  </span>
                  <span className="font-bold text-white">{scenario.scenario_name}</span>
                  {scenario.is_modified && (
                    <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[9px] font-bold">
                      [MODIFIED]
                    </span>
                  )}
                </div>
                <div className="h-3.5 w-px bg-neutral-800 hidden sm:block" />
                <div className="flex items-center space-x-3 text-neutral-400 text-[11px]">
                  <span>
                    <strong className="text-white">{scenario.warehouses.length}</strong> Warehouses
                  </span>
                  <span>
                    <strong className="text-white">{scenario.stores.length}</strong> Stores
                  </span>
                  <span>
                    Budget:{' '}
                    <strong className="text-white">
                      MYR {scenario.budget_cap_myr?.toLocaleString() ?? '7,000'}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveView('organization')}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-white hover:text-black border border-neutral-700 text-neutral-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  [CONFIGURE IN ORGANIZATION &rarr;]
                </button>
                <button
                  type="button"
                  onClick={() => runEvaluation(scenario, fleet)}
                  disabled={loading}
                  className="px-4 py-1.5 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 text-black disabled:text-neutral-500 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {loading ? 'Evaluating...' : 'Run Engine'}
                </button>
              </div>
            </div>

            {/* STACKED SIMULATOR LAYOUT: Map First (Full Width), then Stages Below */}
            <div className="space-y-6">
              {/* 1. Map View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-neutral-400">
                  <span>Multi-Modal Network Topology</span>
                  <span className="font-bold text-white">
                    {reachabilityResult ? `${reachabilityResult.edges.length} Edges Active` : 'Topological Map'}
                  </span>
                </div>
                <MapView
                  warehouses={scenario.warehouses}
                  stores={scenario.stores}
                  edges={reachabilityResult?.edges ?? []}
                  itineraries={stage4Result?.itineraries ?? []}
                  trucks={fleet.length > 0 ? fleet : (stage4Result?.available_trucks ?? [])}
                  highlightedPath={selectedAllocation?.path_coordinates}
                  highlightLabel={
                    selectedAllocation
                      ? `[FLOW] ${selectedAllocation.quantity} units P${selectedAllocation.product_id}: ${selectedAllocation.source_name} -> ${selectedAllocation.target_name}`
                      : undefined
                  }
                  panTarget={panTarget}
                  onSelectStore={(s) => setPanTarget([s.latitude, s.longitude])}
                  onSelectWarehouse={(w) => setPanTarget([w.latitude, w.longitude])}
                />
              </div>

              {/* 2. Optimization Pipeline Stages (Stacked below Map) */}
              <div className="space-y-3">
                {/* Stage Selector Tabs */}
                <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 pb-2">
                  <button
                    onClick={() => setActiveStageTab('stage4')}
                    className={`px-3 py-1.5 rounded-none text-xs font-mono font-bold transition-colors cursor-pointer ${
                      activeStageTab === 'stage4'
                        ? 'bg-white text-black'
                        : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
                    }`}
                  >
                    Stage 4: Fleet & Budget
                  </button>
                  <button
                    onClick={() => setActiveStageTab('stage3')}
                    className={`px-3 py-1.5 rounded-none text-xs font-mono font-bold transition-colors cursor-pointer ${
                      activeStageTab === 'stage3'
                        ? 'bg-white text-black'
                        : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
                    }`}
                  >
                    Stage 3: Flow
                  </button>
                  <button
                    onClick={() => setActiveStageTab('stage2')}
                    className={`px-3 py-1.5 rounded-none text-xs font-mono font-bold transition-colors cursor-pointer ${
                      activeStageTab === 'stage2'
                        ? 'bg-white text-black'
                        : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
                    }`}
                  >
                    Stage 2: Reach
                  </button>
                  <button
                    onClick={() => setActiveStageTab('stage1')}
                    className={`px-3 py-1.5 rounded-none text-xs font-mono font-bold transition-colors cursor-pointer ${
                      activeStageTab === 'stage1'
                        ? 'bg-white text-black'
                        : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
                    }`}
                  >
                    Stage 1: Feasible
                  </button>
                </div>

                {/* Active Panel View */}
                {activeStageTab === 'stage4' ? (
                  <FleetPanel
                    result={stage4Result}
                    loading={loading}
                    onSelectItinerary={(itin) => {
                      if (itin && itin.legs.length > 0) {
                        const coords: [number, number][] = itin.legs.flatMap((l) => l.path_coordinates);
                        setSelectedAllocation({
                          allocation_id: itin.allocation_id,
                          source_id: itin.source_warehouse_id,
                          source_name: itin.source_warehouse_name,
                          target_id: itin.target_store_id,
                          target_name: itin.target_store_name,
                          product_id: itin.product_id,
                          quantity: itin.quantity_units,
                          modality: 0,
                          route_type: 'DIRECT_HIGHWAY',
                          distance_km: itin.total_distance_km,
                          transit_hours: itin.total_transit_hours,
                          path_coordinates: coords.length > 0 ? coords : undefined,
                          status: 'ALLOCATED',
                        });
                      } else {
                        setSelectedAllocation(null);
                      }
                    }}
                    onSelectStore={handleSelectStore}
                  />
                ) : activeStageTab === 'stage3' ? (
                  <FlowPanel
                    result={flowResult}
                    loading={loading}
                    onSelectAllocation={setSelectedAllocation}
                    onSelectStore={handleSelectStore}
                  />
                ) : activeStageTab === 'stage2' ? (
                  <ReachabilityPanel
                    result={reachabilityResult}
                    loading={loading}
                  />
                ) : (
                  <FeasibilityPanel
                    result={feasibilityResult}
                    loading={loading}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-neutral-900 py-4 px-6 text-center text-xs text-neutral-500 font-mono">
        ScenariGo Simulation Engine | Discrete Optimization & Multi-Modal Logistics
      </footer>
    </div>
  );
}

export default App;
