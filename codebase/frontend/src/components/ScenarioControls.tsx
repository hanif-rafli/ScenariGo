import React, { useRef } from 'react';
import { Play, RotateCcw, AlertTriangle, Upload } from 'lucide-react';
import { SimulationRequest } from '../types/simulation';
import { parseWarehousesCSV, parseStoresCSV } from '../services/csvParser';

interface ScenarioControlsProps {
  currentScenario: SimulationRequest;
  onSelectPreset: (presetType: 'bob' | 'deficit') => void;
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
    <div className="bg-black border border-neutral-800 rounded-lg p-5 shadow-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-widest font-mono">
            Scenario Control & Presets
          </h2>
          <p className="text-xs font-mono text-neutral-400 mt-0.5">
            Select industrial test scenario or ingest local CSV files
          </p>
        </div>

        {/* Primary Action Button */}
        <div>
          <button
            onClick={onRunFeasibility}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 text-black disabled:text-neutral-500 rounded text-xs font-bold font-mono tracking-wider uppercase transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? 'Evaluating...' : 'Run Feasibility Engine'}</span>
          </button>
        </div>
      </div>

      {/* Preset Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onSelectPreset('bob')}
          className="flex items-start space-x-3 p-3 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-white rounded text-left transition-all"
        >
          <div className="p-2 bg-neutral-900 border border-neutral-700 rounded text-white">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white uppercase tracking-wide">
              Preset 1: Bob's Stationery Baseline
            </div>
            <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
              Balanced supply across KL, Penang & Kuching (P0, P1, P2). Expected: FEASIBLE.
            </div>
          </div>
        </button>

        <button
          onClick={() => onSelectPreset('deficit')}
          className="flex items-start space-x-3 p-3 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-white rounded text-left transition-all"
        >
          <div className="p-2 bg-neutral-900 border border-neutral-700 rounded text-white">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white uppercase tracking-wide">
              Preset 2: East Malaysia Stockout
            </div>
            <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
              Kuching store demand for P1 exceeds aggregate supply. Expected: EARLY CUTOFF.
            </div>
          </div>
        </button>
      </div>

      {/* Scenario Metadata & CSV Ingestion */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono text-neutral-400 border-t border-neutral-800">
        <div className="flex items-center space-x-5">
          <span>Warehouses: <strong className="text-white font-bold">{currentScenario.warehouses.length}</strong></span>
          <span>Stores: <strong className="text-white font-bold">{currentScenario.stores.length}</strong></span>
          <span>Budget Cap: <strong className="text-white font-bold">MYR {currentScenario.budget_cap_myr?.toLocaleString() ?? '7,000'}</strong></span>
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
            className="flex items-center space-x-1.5 px-3 py-1 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white rounded text-[11px] font-mono text-neutral-300 hover:text-white transition-colors"
          >
            <Upload className="w-3 h-3" />
            <span>Upload Warehouses CSV</span>
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
            className="flex items-center space-x-1.5 px-3 py-1 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white rounded text-[11px] font-mono text-neutral-300 hover:text-white transition-colors"
          >
            <Upload className="w-3 h-3" />
            <span>Upload Stores CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
