import React, { useState } from 'react';
import { Stage3Result, AllocationItem } from '../types/simulation';
import { CheckCircle2, AlertTriangle, ArrowRight, Ship, Truck, Layers, Filter } from 'lucide-react';

interface FlowPanelProps {
  result: Stage3Result | null;
  loading: boolean;
  onSelectAllocation?: (allocation: AllocationItem | null) => void;
}

export const FlowPanel: React.FC<FlowPanelProps> = ({
  result,
  loading,
  onSelectAllocation,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedModality, setSelectedModality] = useState<'ALL' | 'LAND' | 'MARITIME'>('ALL');

  if (loading) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-6 font-mono text-center space-y-3 shadow-2xl">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        <p className="text-xs text-neutral-400 uppercase tracking-widest">
          Solving Ford-Fulkerson circulation with lower bounds...
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-6 font-mono text-center text-xs text-neutral-500 shadow-2xl">
        Run simulation to compute multi-commodity network flow.
      </div>
    );
  }

  const filteredAllocations = result.allocations.filter((a) => {
    const matchProd = selectedProduct === 'ALL' || a.product_id === selectedProduct;
    const matchMod =
      selectedModality === 'ALL' ||
      (selectedModality === 'LAND' && a.modality === 0) ||
      (selectedModality === 'MARITIME' && a.modality === 1);
    return matchProd && matchMod;
  });

  const uniqueProducts = Array.from(new Set(result.allocations.map((a) => a.product_id))).sort();

  return (
    <div className="bg-black border border-neutral-800 rounded-lg p-5 font-mono space-y-5 shadow-2xl">
      {/* 1. Header Status Badge */}
      <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            {result.is_flow_feasible ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-neutral-900 border border-white text-white text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>[VERIFIED: STAGE 3 FLOW FEASIBLE]</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-neutral-900 border border-red-500 text-red-400 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>[FAIL: CIRCULATION BOTTLENECK]</span>
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-300 pt-1 leading-relaxed">
            {result.summary}
          </p>
        </div>
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
          FORD-FULKERSON CIRCULATION
        </span>
      </div>

      {/* 2. Top-Level Flow Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Satisfied</div>
          <div className="text-lg font-bold text-white mt-0.5">
            {result.total_demand_satisfied} <span className="text-xs text-neutral-500 font-normal">/ {result.total_demand_requested}</span>
          </div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Satisfaction</div>
          <div className={`text-lg font-bold mt-0.5 ${result.satisfaction_rate_pct === 100 ? 'text-white' : 'text-red-400'}`}>
            {result.satisfaction_rate_pct}%
          </div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Shipments</div>
          <div className="text-lg font-bold text-white mt-0.5">
            {result.allocations.length} <span className="text-xs text-neutral-500 font-normal">flows</span>
          </div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Bottlenecks</div>
          <div className={`text-lg font-bold mt-0.5 ${result.bottlenecks.length === 0 ? 'text-white' : 'text-red-400'}`}>
            {result.bottlenecks.length}
          </div>
        </div>
      </div>

      {/* 3. Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-y border-neutral-900 py-2">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-neutral-400">Filter Product:</span>
          <button
            onClick={() => setSelectedProduct('ALL')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              selectedProduct === 'ALL'
                ? 'bg-white text-black font-bold'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            ALL
          </button>
          {uniqueProducts.map((pid) => (
            <button
              key={`filter-p-${pid}`}
              onClick={() => setSelectedProduct(pid)}
              className={`px-2 py-0.5 rounded text-[11px] ${
                selectedProduct === pid
                  ? 'bg-white text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              P{pid}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-neutral-400">Modality:</span>
          <button
            onClick={() => setSelectedModality('ALL')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              selectedModality === 'ALL' ? 'bg-neutral-800 text-white' : 'text-neutral-500'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedModality('LAND')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              selectedModality === 'LAND' ? 'bg-amber-900/60 text-amber-300 border border-amber-600' : 'text-neutral-500'
            }`}
          >
            Land
          </button>
          <button
            onClick={() => setSelectedModality('MARITIME')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              selectedModality === 'MARITIME' ? 'bg-sky-950 text-sky-400 border border-sky-600' : 'text-neutral-500'
            }`}
          >
            Sea
          </button>
        </div>
      </div>

      {/* 4. Commodity Allocation Matrix */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Optimal Commodity Dispatches</span>
          </span>
          <span className="text-[11px] text-neutral-500 font-normal">
            {filteredAllocations.length} of {result.allocations.length} Active
          </span>
        </div>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {filteredAllocations.map((alloc) => {
            const isSea = alloc.modality === 1;

            return (
              <div
                key={alloc.allocation_id}
                onMouseEnter={() => onSelectAllocation && onSelectAllocation(alloc)}
                onMouseLeave={() => onSelectAllocation && onSelectAllocation(null)}
                className="bg-neutral-950 border border-neutral-800 hover:border-neutral-600 p-2.5 rounded text-xs space-y-1.5 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{alloc.allocation_id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        isSea
                          ? 'bg-sky-950 text-sky-300 border-sky-600'
                          : 'bg-amber-950/70 text-amber-300 border-amber-600'
                      }`}
                    >
                      {isSea ? (
                        <span className="flex items-center space-x-1">
                          <Ship className="w-2.5 h-2.5" />
                          <span>SEA FAIRWAY</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1">
                          <Truck className="w-2.5 h-2.5" />
                          <span>HIGHWAY E1</span>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 text-white font-bold rounded text-[11px]">
                      P{alloc.product_id}
                    </span>
                    <span className="text-white font-bold text-sm">
                      {alloc.quantity} units
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-neutral-300 text-[11px]">
                  <span className="text-white">{alloc.source_name}</span>
                  <ArrowRight className="w-3 h-3 text-neutral-500" />
                  <span className="text-white font-bold">{alloc.target_name}</span>
                </div>

                {isSea && alloc.departure_port_name && (
                  <div className="text-[10px] text-sky-400">
                    Transshipment: {alloc.departure_port_name} &rarr; {alloc.arrival_port_name}
                  </div>
                )}

                <div className="flex justify-between text-[10px] text-neutral-500 border-t border-neutral-900 pt-1">
                  <span>Distance: {alloc.distance_km} km</span>
                  <span>Est. Transit: ~{alloc.transit_hours} hrs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Corridor Throughput & Utilization */}
      {result.corridor_utilizations.length > 0 && (
        <div className="space-y-2 border-t border-neutral-900 pt-3">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Corridor Saturation & Capacity
          </div>
          <div className="space-y-2 text-[11px]">
            {result.corridor_utilizations.map((c) => (
              <div key={c.corridor_name} className="space-y-1">
                <div className="flex justify-between text-neutral-400 text-[10px]">
                  <span>{c.corridor_name}</span>
                  <span className="text-white font-bold">
                    {c.flow_units} / {c.capacity_units} units ({c.utilization_pct}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      c.modality === 1 ? 'bg-sky-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${Math.min(c.utilization_pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Actionable Audit Tokens */}
      <div className="space-y-2 border-t border-neutral-900 pt-3">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          Flow Audit Tokens
        </div>
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
          {result.tokens.map((token, i) => (
            <div
              key={`token-${i}`}
              className="text-[11px] leading-relaxed p-2 rounded bg-neutral-950 border border-neutral-900 text-neutral-300"
            >
              {token}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
