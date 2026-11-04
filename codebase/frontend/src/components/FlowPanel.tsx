import React, { useState } from 'react';
import { Stage3Result, AllocationItem } from '../types/simulation';
import { CheckCircle2, AlertTriangle, ArrowRight, Ship, Truck, Layers, Filter, XCircle } from 'lucide-react';

interface FlowPanelProps {
  result: Stage3Result | null;
  loading: boolean;
  onSelectAllocation?: (allocation: AllocationItem | null) => void;
  onSelectStore?: (storeId: number | string) => void;
}

export const FlowPanel: React.FC<FlowPanelProps> = ({
  result,
  loading,
  onSelectAllocation,
  onSelectStore,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedModality, setSelectedModality] = useState<'ALL' | 'LAND' | 'MARITIME'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALLOCATED' | 'SHORTFALL'>('ALL');

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

  const bottlenecks = result.bottleneck_details || [];

  const filteredAllocations = result.allocations.filter((a) => {
    const matchProd = selectedProduct === 'ALL' || a.product_id === selectedProduct;
    const matchMod =
      selectedModality === 'ALL' ||
      (selectedModality === 'LAND' && a.modality === 0) ||
      (selectedModality === 'MARITIME' && a.modality === 1);
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ALLOCATED' && a.status === 'ALLOCATED') ||
      (statusFilter === 'SHORTFALL' && a.status === 'SHORTFALL');
    return matchProd && matchMod && matchStatus;
  });

  const uniqueProducts = Array.from(new Set(result.allocations.map((a) => a.product_id))).sort();
  const shortfallCount = result.allocations.filter((a) => a.status === 'SHORTFALL').length;

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
            {result.allocations.filter((a) => a.status === 'ALLOCATED').length} <span className="text-xs text-neutral-500 font-normal">flows</span>
          </div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Bottlenecks</div>
          <div className={`text-lg font-bold mt-0.5 ${bottlenecks.length === 0 ? 'text-white' : 'text-red-400'}`}>
            {bottlenecks.length}
          </div>
        </div>
      </div>

      {/* 3. Granular Causal Bottleneck Traceability Panel */}
      {bottlenecks.length > 0 && (
        <div className="border border-red-500/70 bg-red-950/20 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-red-900/50 pb-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-red-400 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>Root Cause & Bottleneck Traceability</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-800 font-bold">
              {bottlenecks.length} UNFULFILLED DEMAND BOUND(S)
            </span>
          </div>

          <div className="space-y-3">
            {bottlenecks.map((b) => (
              <div
                key={b.bottleneck_id}
                className="bg-black/80 border border-red-900/80 rounded p-3 text-xs space-y-2 font-mono"
              >
                {/* Specific Target & Shortfall Header */}
                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-neutral-800 pb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-400 font-bold">{b.bottleneck_id}</span>
                    <button
                      type="button"
                      onClick={() => onSelectStore?.(b.store_id)}
                      className="text-white hover:text-cyan-400 font-bold underline decoration-neutral-600 hover:decoration-cyan-400 text-left transition-colors cursor-pointer flex items-center space-x-1.5"
                      title="Click to pan camera to Store"
                    >
                      <span>Store S{b.store_id}: {b.store_name}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-cyan-300 font-normal">
                        PAN MAP
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs font-bold">
                    <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 text-white rounded">
                      P{b.product_id}
                    </span>
                    <span className="text-red-400">
                      Shortfall: {b.shortfall_units} units
                    </span>
                  </div>
                </div>

                {/* Mathematical Equation & Quantification */}
                <div className="grid grid-cols-3 gap-2 text-[11px] bg-neutral-950 p-2 rounded border border-neutral-800">
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase">Requested</span>
                    <span className="text-white font-bold">{b.requested_units} units</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase">Delivered</span>
                    <span className="text-white font-bold">{b.allocated_units} units</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block text-[10px] uppercase">Unmet Deficit</span>
                    <span className="text-red-400 font-bold">{b.shortfall_units} units</span>
                  </div>
                </div>

                {/* Structured Cause Breakdown - Pure Key-Value, No Paragraphs */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px] uppercase">Root Cause</span>
                    <span className="text-red-400 font-bold">
                      {b.bottleneck_type === 'SUPPLY_EXHAUSTION' ? 'WAREHOUSE STOCK DEPLETED' : b.bottleneck_type}
                    </span>
                  </div>
                  <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px] uppercase">Regional Supply Cap</span>
                    <span className="text-white font-bold">
                      {b.allocated_units} / {b.requested_units} units ({Math.round((b.allocated_units / b.requested_units) * 100)}% met)
                    </span>
                  </div>
                </div>

                {b.contributing_warehouses.length > 0 && (
                  <div className="space-y-1.5 bg-neutral-950 p-2.5 rounded border border-neutral-800">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold block">
                      Depleted Supply Sources:
                    </span>
                    <div className="space-y-1">
                      {b.contributing_warehouses.map((wh, idx) => {
                        const colonIdx = wh.indexOf(':');
                        const whName = colonIdx !== -1 ? wh.substring(0, colonIdx).trim() : wh;
                        const whStatus = colonIdx !== -1 ? wh.substring(colonIdx + 1).trim() : 'Depleted';
                        return (
                          <div
                            key={`wh-dep-${idx}`}
                            className="flex items-center justify-between text-[11px] bg-neutral-900/80 px-2 py-1 rounded border border-neutral-800"
                          >
                            <span className="text-neutral-300 font-mono">{whName}</span>
                            <span className="text-red-400 font-mono font-bold">{whStatus}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Filter Controls */}
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

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
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

          {shortfallCount > 0 && (
            <div className="flex items-center space-x-1 border-l border-neutral-800 pl-3">
              <button
                onClick={() => setStatusFilter(statusFilter === 'SHORTFALL' ? 'ALL' : 'SHORTFALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  statusFilter === 'SHORTFALL'
                    ? 'bg-red-950 text-red-300 border-red-500'
                    : 'bg-neutral-900 text-red-400 border-red-900 hover:border-red-700'
                }`}
              >
                Deficits Only ({shortfallCount})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Commodity Allocation Matrix */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Optimal Commodity Dispatches</span>
          </span>
          <span className="text-[11px] text-neutral-500 font-normal">
            {filteredAllocations.length} of {result.allocations.length} Displayed
          </span>
        </div>

        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {filteredAllocations.map((alloc) => {
            const isSea = alloc.modality === 1;
            const isShortfall = alloc.status === 'SHORTFALL';

            if (isShortfall) {
              return (
                <div
                  key={alloc.allocation_id}
                  className="bg-red-950/20 border border-red-500/70 p-2.5 rounded text-xs space-y-1.5 font-mono"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-red-400">{alloc.allocation_id}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900/60 text-red-300 border border-red-700 flex items-center space-x-1">
                        <XCircle className="w-3 h-3 text-red-400" />
                        <span>UNFULFILLED DEFICIT</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 text-white font-bold rounded text-[11px]">
                        P{alloc.product_id}
                      </span>
                      <span className="text-red-400 font-bold text-sm">
                        -{alloc.quantity} units
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-neutral-300">
                    Target: <span className="text-white font-bold">{alloc.target_name}</span> (ID: S{alloc.target_id})
                  </div>
                  <div className="text-[10px] text-red-400/90 border-t border-red-900/50 pt-1">
                    Failed demand lower bound. Insufficient upstream warehouse inventory or saturated transport corridor.
                  </div>
                </div>
              );
            }

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
                  <span className="text-neutral-300">{alloc.source_name}</span>
                  <ArrowRight className="w-3 h-3 text-neutral-500" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStore?.(alloc.target_id);
                    }}
                    className="text-white font-bold hover:text-cyan-400 underline decoration-neutral-700 hover:decoration-cyan-400 transition-colors text-left cursor-pointer"
                    title="Click to pan camera to destination store"
                  >
                    {alloc.target_name}
                  </button>
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

      {/* 6. Route Shipping Volume & Capacity Limits */}
      {result.corridor_utilizations.length > 0 && (
        <div className="space-y-2 border-t border-neutral-900 pt-3">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Route Shipping Volume & Limits
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

      {/* 7. Actionable Audit Tokens */}
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
