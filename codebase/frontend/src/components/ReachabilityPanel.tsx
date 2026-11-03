import React from 'react';
import { Stage2Result } from '../types/simulation';
import { Network, Ship, Check, AlertCircle } from 'lucide-react';

interface ReachabilityPanelProps {
  result: Stage2Result | null;
  loading: boolean;
}

export const ReachabilityPanel: React.FC<ReachabilityPanelProps> = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-5 text-center animate-pulse">
        <div className="text-xs font-mono text-neutral-400">
          [ENGINE: EVALUATING STAGE 2 REACHABILITY & PARTITIONING...]
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-5 text-center">
        <Network className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <div className="text-xs font-mono text-neutral-300 uppercase tracking-wider">
          No Topological Reachability Data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black border border-neutral-800 rounded-lg p-5 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 px-3 py-1 rounded bg-neutral-900 border border-neutral-700 text-white font-mono text-xs font-bold tracking-wider">
            <Network className="w-4 h-4" />
            <span>[STAGE 2: TOPOLOGICAL PARTITIONING]</span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-400">
          {result.components.length} Subgraphs Identified
        </div>
      </div>

      {/* Summary Box */}
      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded text-xs font-mono text-neutral-300 leading-relaxed">
        {result.summary}
      </div>

      {/* Components Breakdown */}
      <div className="space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          Regional Subgraph Partitioning:
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {result.components.map((comp) => {
            const isSelfSufficient = comp.is_self_sufficient;
            return (
              <div
                key={comp.component_id}
                className="p-3 bg-neutral-950 border border-neutral-800 rounded text-xs font-mono space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs tracking-wide">
                    {comp.name}
                  </span>
                  {isSelfSufficient ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-900 text-emerald-400 border border-emerald-800 font-bold flex items-center space-x-1">
                      <Check className="w-3 h-3 inline" />
                      <span>[LAND SELF-SUFFICIENT]</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-900 text-amber-400 border border-amber-800 font-bold flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3 inline" />
                      <span>[ISLAND DEFICIT]</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 border-t border-neutral-900 pt-1.5">
                  <div>
                    <span>Warehouses: </span>
                    <strong className="text-white">W{comp.warehouse_ids.join(', W')}</strong>
                  </div>
                  <div>
                    <span>Stores: </span>
                    <strong className="text-white">S{comp.store_ids.join(', S')}</strong>
                  </div>
                </div>

                {/* Unmet local island demands */}
                {!isSelfSufficient && Object.keys(comp.unmet_demand).length > 0 && (
                  <div className="bg-neutral-900/80 p-2 rounded border border-neutral-800 text-[11px] space-y-1">
                    <span className="text-neutral-400 font-semibold">Unstocked in this landmass:</span>
                    {Object.entries(comp.unmet_demand).map(([pid, qty]) => (
                      <div key={pid} className="flex justify-between text-amber-300">
                        <span>Product P{pid} Shortfall:</span>
                        <strong className="font-bold">+{qty} units required cross-strait</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Intermodal Gateway Routes */}
      {result.intermodal_routes.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 flex items-center space-x-1.5">
            <Ship className="w-3.5 h-3.5" />
            <span>Activated Maritime Corridors:</span>
          </div>

          <div className="space-y-2">
            {result.intermodal_routes.map((route, idx) => (
              <div
                key={idx}
                className="p-3 bg-neutral-950 border border-cyan-900/60 rounded text-xs font-mono space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-neutral-300 border-b border-neutral-800 pb-1.5">
                  <span className="font-bold text-white">
                    {route.departure_port_name} &rarr; {route.arrival_port_name}
                  </span>
                  <span className="text-cyan-400 font-bold">
                    [SEA: {route.sea_distance_km} km | ~{route.sea_transit_hours} hrs]
                  </span>
                </div>

                <div className="text-[11px] text-neutral-400">
                  Fulfilling: <strong className="text-white">{route.target_store_name}</strong> with{' '}
                  <strong className="text-amber-400">{route.quantity} units P{route.product_id}</strong>
                </div>

                <div className="flex justify-between items-center text-[11px] text-neutral-400 pt-1">
                  <span>Carrier Surcharge:</span>
                  <span className="text-emerald-400 font-bold">
                    MYR {route.estimated_carrier_cost_myr.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
