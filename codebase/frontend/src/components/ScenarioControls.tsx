import React, { useRef } from 'react';
import { SimulationRequest } from '../types/simulation';
import { parseWarehousesCSV, parseStoresCSV } from '../services/csvParser';

interface ScenarioControlsProps {
  currentScenario: SimulationRequest;
  onSelectPreset: (presetType: 'bob' | 'deficit' | 'air' | 'tri-port') => void;
  onRunFeasibility: () => void;
  onCustomScenarioLoaded: (scenario: SimulationRequest) => void;
  loading: boolean;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  currentScenario,
  onSelectPreset,
  onRunFeasibility,
  onCustomScenarioLoaded,
  loading,
}) => {
  const warehouseFileRef = useRef<HTMLInputElement>(null);
  const storeFileRef = useRef<HTMLInputElement>(null);

  const handleWarehouseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsedWarehouses = parseWarehousesCSV(text);
      onCustomScenarioLoaded({
        ...currentScenario,
        scenario_name: 'Custom Ingested Scenario',
        warehouses: parsedWarehouses,
      });
    };
    reader.readAsText(file);
  };

  const handleStoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsedStores = parseStoresCSV(text);
      onCustomScenarioLoaded({
        ...currentScenario,
        scenario_name: 'Custom Ingested Scenario',
        stores: parsedStores,
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-neutral-950 p-5 space-y-4 rounded-none font-mono">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">
            Scenario Control & Presets
          </h2>
          <p className="text-xs text-white mt-0.5">
            Select industrial test scenario or ingest local CSV files
          </p>
        </div>

        {/* Primary Action Button */}
        <div>
          <button
            onClick={onRunFeasibility}
            disabled={loading}
            className="px-4 py-2 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 text-black disabled:text-neutral-500 rounded-none text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
          >
            <span>{loading ? 'Evaluating...' : 'Run Feasibility Engine'}</span>
          </button>
        </div>
      </div>

      {/* Preset Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => onSelectPreset('bob')}
          className="p-3 bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-white rounded-none text-left transition-all cursor-pointer"
        >
          <div className="text-xs font-bold text-white uppercase tracking-wide">
            Preset 1: Bob's Stationery Baseline
          </div>
          <div className="text-[11px] text-white mt-1">
            Balanced supply across KL, Penang & Kuching (P0, P1, P2). Expected: FEASIBLE.
          </div>
        </button>

        <button
          onClick={() => onSelectPreset('deficit')}
          className="p-3 bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-white rounded-none text-left transition-all cursor-pointer"
        >
          <div className="text-xs font-bold text-white uppercase tracking-wide">
            Preset 2: East Malaysia Stockout
          </div>
          <div className="text-[11px] text-white mt-1">
            Kuching store demand for P1 exceeds aggregate supply. Expected: EARLY CUTOFF.
          </div>
        </button>

        <button
          onClick={() => onSelectPreset('air')}
          className="p-3 bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-white rounded-none text-left transition-all cursor-pointer"
        >
          <div className="text-xs font-bold text-white uppercase tracking-wide">
            Preset 3: Expedited Air Freight
          </div>
          <div className="text-[11px] text-white mt-1">
            KLIA Cargo Hub to Kuching Air Hub across flight corridor. Expected: EXPEDITED AIR.
          </div>
        </button>

        <button
          onClick={() => onSelectPreset('tri-port')}
          className="p-3 bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-white rounded-none text-left transition-all cursor-pointer"
        >
          <div className="text-xs font-bold text-white uppercase tracking-wide">
            Preset 4: Tri-Port Multi-Gateway
          </div>
          <div className="text-[11px] text-white mt-1">
            Butterworth, Port Klang & PTP Johor to Kuching Port. Expected: MULTI-MODAL FLOW.
          </div>
        </button>
      </div>

      {/* Scenario Metadata & CSV Ingestion */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-white border-t border-neutral-800">
        <div className="flex items-center space-x-5">
          <span>Warehouses: <strong className="font-bold">{currentScenario.warehouses.length}</strong></span>
          <span>Stores: <strong className="font-bold">{currentScenario.stores.length}</strong></span>
          <span>Budget Cap: <strong className="font-bold">MYR {currentScenario.budget_cap_myr?.toLocaleString() ?? '7,000'}</strong></span>
        </div>

        {/* CSV Ingestion Buttons */}
        <div className="flex items-center space-x-2">
          <input
            type="file"
            ref={warehouseFileRef}
            onChange={handleWarehouseUpload}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => warehouseFileRef.current?.click()}
            className="px-3 py-1 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white rounded-none text-[11px] text-white transition-colors cursor-pointer"
          >
            Upload Warehouses CSV
          </button>

          <input
            type="file"
            ref={storeFileRef}
            onChange={handleStoreUpload}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => storeFileRef.current?.click()}
            className="px-3 py-1 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white rounded-none text-[11px] text-white transition-colors cursor-pointer"
          >
            Upload Stores CSV
          </button>
        </div>
      </div>
    </div>
  );
};
