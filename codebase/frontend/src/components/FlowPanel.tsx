import React, { useState } from 'react';
import { Stage3Result, AllocationItem } from '../types/simulation';

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
      <div className="bg-neutral-950 p-6 font-mono text-center space-y-3 rounded-none">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-white border-t-transparent"></div>
        <p className="text-xs text-white uppercase tracking-widest">
          Solving Ford-Fulkerson circulation with lower bounds...
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-neutral-950 p-6 font-mono text-center text-xs text-white rounded-none">
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
    <div className="bg-neutral-950 p-5 font-mono space-y-5 rounded-none text-white">
      {/* 1. Header Status Badge */}
      <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            {result.is_flow_feasible ? (
              <span className="px-2.5 py-1 bg-white text-black text-xs font-bold rounded-none">
                [VERIFIED: STAGE 3 FLOW FEASIBLE]
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-black border border-white text-white text-xs font-bold rounded-none">
                [FAIL: CIRCULATION BOTTLENECK]
              </span>
            )}
          </div>
          <p className="text-xs text-white pt-1 leading-relaxed">
            {result.summary}
          </p>
        </div>
        <span className="text-[10px] text-white uppercase tracking-wider">
          FORD-FULKERSON CIRCULATION
        </span>
      </div>

      {/* 2. Top-Level Flow Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-black p-2.5 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Satisfied</div>
          <div className="text-lg font-bold text-white mt-0.5">
            {result.total_demand_satisfied} <span className="text-xs font-normal">/ {result.total_demand_requested}</span>
          </div>
        </div>
        <div className="bg-black p-2.5 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Satisfaction</div>
          <div className="text-lg font-bold text-white mt-0.5">
            {result.satisfaction_rate_pct}%
          </div>
        </div>
        <div className="bg-black p-2.5 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Shipments</div>
          <div className="text-lg font-bold text-white mt-0.5">
            {result.allocations.filter((a) => a.status === 'ALLOCATED').length} <span className="text-xs font-normal">flows</span>
          </div>
        </div>
        <div className="bg-black p-2.5 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Bottlenecks</div>
          <div className="text-lg font-bold text-white mt-0.5">
            {bottlenecks.length}
          </div>
        </div>
      </div>

      {/* 3. Granular Causal Bottleneck Traceability Panel */}
      {bottlenecks.length > 0 && (
        <div className="bg-black p-3.5 space-y-3 rounded-none border-l-2 border-white">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Root Cause & Bottleneck Traceability
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-white text-black font-bold rounded-none">
              {bottlenecks.length} UNFULFILLED DEMAND BOUND(S)
            </span>
          </div>

          <div className="space-y-3">
            {bottlenecks.map((b) => (
              <div
                key={b.bottleneck_id}
                className="bg-neutral-900 p-3 text-xs space-y-2 font-mono rounded-none"
              >
                {/* Specific Target & Shortfall Header */}
                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-neutral-800 pb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold">{b.bottleneck_id}</span>
                    <button
                      type="button"
                      onClick={() => onSelectStore?.(b.store_id)}
                      className="text-white hover:underline font-bold text-left cursor-pointer"
                      title="Click to pan camera to Store"
                    >
                      Store S{b.store_id}: {b.store_name} [PAN MAP]
                    </button>
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs font-bold">
                    <span className="px-1.5 py-0.5 bg-black border border-white text-white rounded-none">
                      P{b.product_id}
                    </span>
                    <span>Shortfall: {b.shortfall_units} units</span>
                  </div>
                </div>

                {/* Mathematical Equation & Quantification */}
                <div className="grid grid-cols-3 gap-2 text-[11px] bg-black p-2 rounded-none">
                  <div>
                    <span className="block text-[10px] uppercase">Requested</span>
                    <span className="font-bold">{b.requested_units} units</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">Delivered</span>
                    <span className="font-bold">{b.allocated_units} units</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">Unmet Deficit</span>
                    <span className="font-bold">{b.shortfall_units} units</span>
                  </div>
                </div>

                {/* Structured Cause Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-black p-2 rounded-none">
                    <span className="block text-[10px] uppercase">Root Cause</span>
                    <span className="font-bold">
                      {b.bottleneck_type === 'SUPPLY_EXHAUSTION' ? 'WAREHOUSE STOCK DEPLETED' : b.bottleneck_type}
                    </span>
                  </div>
                  <div className="bg-black p-2 rounded-none">
                    <span className="block text-[10px] uppercase">Regional Supply Cap</span>
                    <span className="font-bold">
                      {b.allocated_units} / {b.requested_units} units ({Math.round((b.allocated_units / b.requested_units) * 100)}% met)
                    </span>
                  </div>
                </div>

                {b.contributing_warehouses.length > 0 && (
                  <div className="space-y-1.5 bg-black p-2.5 rounded-none">
                    <span className="text-[10px] uppercase tracking-wider font-bold block">
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
                            className="flex items-center justify-between text-[11px] bg-neutral-900 px-2 py-1 rounded-none"
                          >
                            <span>{whName}</span>
                            <span className="font-bold">[{whStatus}]</span>
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-y border-neutral-800 py-2">
        <div className="flex items-center space-x-2">
          <span>Filter Product:</span>
          <button
            onClick={() => setSelectedProduct('ALL')}
            className={`px-2 py-0.5 text-[11px] rounded-none cursor-pointer ${
              selectedProduct === 'ALL'
                ? 'bg-white text-black font-bold'
                : 'bg-black text-white hover:bg-neutral-900'
            }`}
          >
            ALL
          </button>
          {uniqueProducts.map((pid) => (
            <button
              key={`filter-p-${pid}`}
              onClick={() => setSelectedProduct(pid)}
              className={`px-2 py-0.5 text-[11px] rounded-none cursor-pointer ${
                selectedProduct === pid
                  ? 'bg-white text-black font-bold'
                  : 'bg-black text-white hover:bg-neutral-900'
              }`}
            >
              P{pid}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span>Modality:</span>
            <button
              onClick={() => setSelectedModality('ALL')}
              className={`px-2 py-0.5 text-[11px] rounded-none cursor-pointer ${
                selectedModality === 'ALL' ? 'bg-white text-black font-bold' : 'bg-black text-white hover:bg-neutral-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedModality('LAND')}
              className={`px-2 py-0.5 text-[11px] rounded-none cursor-pointer ${
                selectedModality === 'LAND' ? 'bg-white text-black font-bold' : 'bg-black text-white hover:bg-neutral-900'
              }`}
            >
              Land
            </button>
            <button
              onClick={() => setSelectedModality('MARITIME')}
              className={`px-2 py-0.5 text-[11px] rounded-none cursor-pointer ${
                selectedModality === 'MARITIME' ? 'bg-white text-black font-bold' : 'bg-black text-white hover:bg-neutral-900'
              }`}
            >
              Sea
            </button>
          </div>

          {shortfallCount > 0 && (
            <div className="flex items-center space-x-1 border-l border-neutral-800 pl-3">
              <button
                onClick={() => setStatusFilter(statusFilter === 'SHORTFALL' ? 'ALL' : 'SHORTFALL')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-none cursor-pointer ${
                  statusFilter === 'SHORTFALL'
                    ? 'bg-white text-black font-bold'
                    : 'bg-black text-white hover:bg-neutral-900'
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
        <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center justify-between">
          <span>Optimal Commodity Dispatches</span>
          <span className="text-[11px] font-normal">
            {filteredAllocations.length} of {result.allocations.length} Displayed
          </span>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {filteredAllocations.map((alloc) => {
            const isSea = alloc.modality === 1;
            const isShortfall = alloc.status === 'SHORTFALL';

            if (isShortfall) {
              return (
                <div
                  key={alloc.allocation_id}
                  className="bg-black p-2.5 text-xs space-y-1.5 font-mono rounded-none border-l-2 border-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold">{alloc.allocation_id}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-black rounded-none">
                        [UNFULFILLED DEFICIT]
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="px-1.5 py-0.5 bg-neutral-900 border border-white font-bold rounded-none text-[11px]">
                        P{alloc.product_id}
                      </span>
                      <span className="font-bold text-sm">
                        -{alloc.quantity} units
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px]">
                    Target: <span className="font-bold">{alloc.target_name}</span> (ID: S{alloc.target_id})
                  </div>
                  <div className="text-[10px] border-t border-neutral-900 pt-1">
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
                className="bg-black hover:bg-neutral-900 p-2.5 text-xs space-y-1.5 transition-colors cursor-pointer rounded-none"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold">{alloc.allocation_id}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold border border-neutral-700 rounded-none">
                      {isSea ? '[SEA FAIRWAY]' : '[HIGHWAY E1]'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 font-bold rounded-none text-[11px]">
                      P{alloc.product_id}
                    </span>
                    <span className="font-bold text-sm">
                      {alloc.quantity} units
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-[11px]">
                  <span>{alloc.source_name}</span>
                  <span>&rarr;</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStore?.(alloc.target_id);
                    }}
                    className="font-bold hover:underline transition-colors text-left cursor-pointer"
                    title="Click to pan camera to destination store"
                  >
                    {alloc.target_name}
                  </button>
                </div>

                {isSea && alloc.departure_port_name && (
                  <div className="text-[10px]">
                    Transshipment: {alloc.departure_port_name} &rarr; {alloc.arrival_port_name}
                  </div>
                )}

                <div className="flex justify-between text-[10px] border-t border-neutral-900 pt-1">
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
          <div className="text-xs font-bold uppercase tracking-wider text-white">
            Route Shipping Volume & Limits
          </div>
          <div className="space-y-2 text-[11px]">
            {result.corridor_utilizations.map((c) => (
              <div key={c.corridor_name} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span>{c.corridor_name}</span>
                  <span className="font-bold">
                    {c.flow_units} / {c.capacity_units} units ({c.utilization_pct}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-900 h-1.5 overflow-hidden rounded-none">
                  <div
                    className="h-full bg-white rounded-none"
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
        <div className="text-xs font-bold uppercase tracking-wider text-white">
          Flow Audit Tokens
        </div>
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
          {result.tokens.map((token, i) => (
            <div
              key={`token-${i}`}
              className="text-[11px] leading-relaxed p-2 bg-black text-white rounded-none"
            >
              {token}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
