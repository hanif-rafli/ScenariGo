import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { ScenarioControls } from './components/ScenarioControls';
import { FeasibilityPanel } from './components/FeasibilityPanel';
import { ReachabilityPanel } from './components/ReachabilityPanel';
import { FlowPanel } from './components/FlowPanel';
import { FleetPanel } from './components/FleetPanel';
import { ManageFleet } from './pages/ManageFleet';
import { GraphView } from './pages/GraphView';
import {
  SimulationRequest,
  Stage1Result,
  Stage2Result,
  Stage3Result,
  Stage4Result,
  AllocationItem,
  TruckInstance,
} from './types/simulation';
import {
  checkBackendHealth,
  fetchBobStationeryPreset,
  fetchDeficitPreset,
  fetchAirFreightPreset,
  fetchTriPortPreset,
  evaluateFeasibility,
  evaluateReachability,
  evaluateNetworkFlow,
  evaluateFleetRouting,
  fetchTruckFleet,
} from './services/api';

const FALLBACK_BASELINE: SimulationRequest = {
  scenario_name: "Bob's Stationery Enterprise Baseline (Local)",
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
};

export function App() {
  const [scenario, setScenario] = useState<SimulationRequest>(FALLBACK_BASELINE);
  const [feasibilityResult, setFeasibilityResult] = useState<Stage1Result | null>(null);
  const [reachabilityResult, setReachabilityResult] = useState<Stage2Result | null>(null);
  const [flowResult, setFlowResult] = useState<Stage3Result | null>(null);
  const [stage4Result, setStage4Result] = useState<Stage4Result | null>(null);
  const [fleet, setFleet] = useState<TruckInstance[]>([]);
  const [activeView, setActiveView] = useState<'simulator' | 'fleet' | 'graph'>('simulator');
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
    }
  };

  const runEvaluation = useCallback(async (targetScenario: SimulationRequest) => {
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
      const stage4 = await evaluateFleetRouting(targetScenario);
      setStage4Result(stage4);
      if (stage4.available_trucks && stage4.available_trucks.length > 0) {
        setFleet(stage4.available_trucks);
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

  useEffect(() => {
    async function init() {
      const isOnline = await checkBackendHealth();
      setBackendOnline(isOnline);

      if (isOnline) {
        try {
          const [baseline, initialFleet] = await Promise.all([
            fetchBobStationeryPreset(),
            fetchTruckFleet(),
          ]);
          setScenario(baseline);
          setFleet(initialFleet);
          await runEvaluation(baseline);
          return;
        } catch (e) {
          console.error('Failed to fetch initial preset:', e);
        }
      }

      await runEvaluation(FALLBACK_BASELINE);
    }

    init();
  }, [runEvaluation]);

  const handleSelectPreset = async (presetType: 'bob' | 'deficit' | 'air' | 'tri-port') => {
    setLoading(true);
    try {
      let targetScenario: SimulationRequest;
      if (backendOnline) {
        if (presetType === 'bob') {
          targetScenario = await fetchBobStationeryPreset();
        } else if (presetType === 'deficit') {
          targetScenario = await fetchDeficitPreset();
        } else if (presetType === 'air') {
          targetScenario = await fetchAirFreightPreset();
        } else {
          targetScenario = await fetchTriPortPreset();
        }
      } else {
        targetScenario = JSON.parse(JSON.stringify(FALLBACK_BASELINE));
        if (presetType === 'deficit') {
          targetScenario.scenario_name = 'East Malaysia Stockout Deficit (Offline)';
          targetScenario.stores[2].requests['1'] = 50;
        } else if (presetType === 'air') {
          targetScenario.scenario_name = 'Expedited Air Freight Transshipment (Offline)';
          targetScenario.warehouses[0].name = 'Kuala Lumpur Hub (KLIA Air Cargo)';
          targetScenario.warehouses[0].latitude = 2.7456;
          targetScenario.warehouses[0].longitude = 101.7072;
          targetScenario.warehouses[0].is_airport = true;
          targetScenario.warehouses[0].is_port = false;
          targetScenario.warehouses[2].name = 'Kuching Air Cargo Hub';
          targetScenario.warehouses[2].latitude = 1.4847;
          targetScenario.warehouses[2].longitude = 110.3472;
          targetScenario.warehouses[2].is_airport = true;
          targetScenario.warehouses[2].is_port = false;
          targetScenario.budget_cap_myr = 9500;
        } else if (presetType === 'tri-port') {
          targetScenario.scenario_name = 'Tri-Port Multi-Gateway Peninsular Logistics (Offline)';
          targetScenario.warehouses = [
            {
              warehouse_id: 0,
              name: 'Kuala Lumpur Hub',
              latitude: 3.139,
              longitude: 101.6869,
              is_port: false,
              inventory: { '0': 40, '1': 30 },
            },
            {
              warehouse_id: 1,
              name: 'Butterworth Logistics Depot',
              latitude: 5.412,
              longitude: 100.37,
              is_port: true,
              inventory: { '0': 20, '2': 40 },
            },
            {
              warehouse_id: 2,
              name: 'Kuching Transshipment Port',
              latitude: 1.5533,
              longitude: 110.3592,
              is_port: true,
              inventory: { '1': 15 },
            },
            {
              warehouse_id: 3,
              name: 'Port Klang Gateway',
              latitude: 2.9985,
              longitude: 101.3928,
              is_port: true,
              inventory: { '0': 30, '1': 20 },
            },
            {
              warehouse_id: 4,
              name: 'Port of Tanjung Pelepas (PTP Johor)',
              latitude: 1.362,
              longitude: 103.551,
              is_port: true,
              inventory: { '0': 25, '1': 20, '2': 20 },
            },
          ];
          targetScenario.stores = [
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
            {
              store_id: 3,
              name: 'Johor Bahru Retail',
              latitude: 1.4927,
              longitude: 103.7414,
              requests: { '0': 20, '2': 15 },
            },
          ];
          targetScenario.budget_cap_myr = 12000;
        }
      }

      setScenario(targetScenario);
      await runEvaluation(targetScenario);
    } catch (err) {
      console.error('Error changing preset:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomScenarioLoaded = async (custom: SimulationRequest) => {
    setScenario(custom);
    await runEvaluation(custom);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-mono selection:bg-white selection:text-black">
      <Header
        backendOnline={backendOnline}
        activeScenarioName={scenario.scenario_name}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeView === 'fleet' ? (
          <ManageFleet
            fleet={fleet}
            itineraries={stage4Result?.itineraries ?? []}
            onAddTruck={(newTruck) => setFleet((prev) => [...prev, newTruck])}
          />
        ) : activeView === 'graph' ? (
          <GraphView
            circulationTrace={flowResult?.graph_trace}
            bipartiteTrace={stage4Result?.graph_trace}
            loading={loading}
          />
        ) : (
          <>
            <ScenarioControls
              currentScenario={scenario}
              onSelectPreset={handleSelectPreset}
              onRunFeasibility={() => runEvaluation(scenario)}
              onCustomScenarioLoaded={handleCustomScenarioLoaded}
              loading={loading}
            />

            {/* STACKED SIMULATOR LAYOUT: Map First (Full Width), then Stages Below */}
            <div className="space-y-6">
              {/* 1. Map View (Stacked on top) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-white">
                  <span>Multi-Modal Network Topology</span>
                  <span className="font-bold">
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
                          route_type: 'DIRECT_HIGHWAY' as any,
                          distance_km: itin.total_distance_km,
                          transit_hours: itin.total_transit_hours,
                          path_coordinates: coords.length > 0 ? coords : undefined,
                          status: 'ALLOCATED' as any,
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

      <footer className="border-t border-neutral-900 py-4 px-6 text-center text-xs text-white font-mono">
        ScenariGo Simulation Engine | Discrete Optimization & Multi-Modal Logistics
      </footer>
    </div>
  );
}

export default App;
