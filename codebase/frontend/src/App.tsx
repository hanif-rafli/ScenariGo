import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { ScenarioControls } from './components/ScenarioControls';
import { FeasibilityPanel } from './components/FeasibilityPanel';
import { SimulationRequest, Stage1Result } from './types/simulation';
import {
  checkBackendHealth,
  fetchBobStationeryPreset,
  fetchDeficitPreset,
  evaluateFeasibility,
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
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const runEvaluation = useCallback(async (targetScenario: SimulationRequest) => {
    setLoading(true);
    try {
      const result = await evaluateFeasibility(targetScenario);
      setFeasibilityResult(result);
    } catch (err) {
      console.warn('Backend evaluation failed, evaluating locally in frontend:', err);
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
          const baseline = await fetchBobStationeryPreset();
          setScenario(baseline);
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

  const handleSelectPreset = async (presetType: 'bob' | 'deficit') => {
    setLoading(true);
    try {
      let targetScenario: SimulationRequest;
      if (backendOnline) {
        targetScenario =
          presetType === 'bob'
            ? await fetchBobStationeryPreset()
            : await fetchDeficitPreset();
      } else {
        targetScenario = JSON.parse(JSON.stringify(FALLBACK_BASELINE));
        if (presetType === 'deficit') {
          targetScenario.scenario_name = 'East Malaysia Stockout Deficit (Offline)';
          targetScenario.stores[2].requests['1'] = 50;
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
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <ScenarioControls
          currentScenario={scenario}
          onSelectPreset={handleSelectPreset}
          onRunFeasibility={() => runEvaluation(scenario)}
          onCustomScenarioLoaded={handleCustomScenarioLoaded}
          loading={loading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-neutral-400">
              <span>Geographic Topology & Hub Locations</span>
              <span className="text-neutral-600">OpenStreetMap (Dark Inverted)</span>
            </div>
            <MapView
              warehouses={scenario.warehouses}
              stores={scenario.stores}
            />
          </div>

          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-neutral-400">
              <span>Stage 1 Feasibility Engine</span>
              <span className="text-neutral-600">O(N) Early Cutoff</span>
            </div>
            <FeasibilityPanel
              result={feasibilityResult}
              loading={loading}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-900 py-4 px-6 text-center text-xs text-neutral-500 font-mono">
        ScenariGo Simulation Engine | Discrete Optimization & Multi-Modal Logistics
      </footer>
    </div>
  );
}

export default App;
