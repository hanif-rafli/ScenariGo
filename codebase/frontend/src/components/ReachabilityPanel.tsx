import React from 'react';
import { Stage2Result } from '../types/simulation';

interface ReachabilityPanelProps {
  result: Stage2Result | null;
  loading: boolean;
}

export const ReachabilityPanel: React.FC<ReachabilityPanelProps> = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-950 p-5 text-center animate-pulse rounded-none">
        <div className="text-xs font-mono text-white">
          [ENGINE: EVALUATING STAGE 2 REACHABILITY & PARTITIONING...]
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-neutral-950 p-5 text-center rounded-none font-mono">
        <div className="text-xs text-white uppercase tracking-wider font-bold">
          No Topological Reachability Data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 p-5 space-y-4 rounded-none font-mono">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="px-3 py-1 bg-white text-black text-xs font-bold tracking-wider rounded-none">
          [STAGE 2: TOPOLOGICAL PARTITIONING]
        </div>

        <div className="text-[10px] text-white">
          {result.components.length} Subgraphs Identified
        </div>
      </div>

      {/* Summary Box */}
      <div className="p-3 bg-black text-xs text-white leading-relaxed rounded-none">
        {result.summary}
      </div>

      {/* Components Breakdown */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-white">
          Regional Subgraph Partitioning:
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {result.components.map((comp) => {
            const isSelfSufficient = comp.is_self_sufficient;
            return (
              <div
                key={comp.component_id}
                className="p-3 bg-black text-xs text-white space-y-2 rounded-none"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs tracking-wide">
                    {comp.name}
                  </span>
                  {isSelfSufficient ? (
                    <span className="px-2 py-0.5 text-[10px] bg-neutral-900 border border-white text-white font-bold rounded-none">
                      [LAND SELF-SUFFICIENT]
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] bg-white text-black font-bold rounded-none">
                      [ISLAND DEFICIT]
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-neutral-800 pt-1.5 text-white">
                  <div>
                    <span>Warehouses: </span>
                    <strong className="font-bold">W{comp.warehouse_ids.join(', W')}</strong>
                  </div>
                  <div>
                    <span>Stores: </span>
                    <strong className="font-bold">S{comp.store_ids.join(', S')}</strong>
                  </div>
                </div>

                {/* Unmet local island demands */}
                {!isSelfSufficient && Object.keys(comp.unmet_demand).length > 0 && (
                  <div className="bg-neutral-900 p-2 text-[11px] space-y-1 rounded-none text-white">
                    <span className="font-semibold block">Unstocked in this landmass:</span>
                    {Object.entries(comp.unmet_demand).map(([pid, qty]) => (
                      <div key={pid} className="flex justify-between">
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
          <div className="text-[10px] uppercase tracking-widest text-white">
            Activated Intermodal Corridors (Sea & Air):
          </div>

          <div className="space-y-2">
            {result.intermodal_routes.map((route, idx) => {
              const isAir = route.modality === 2;
              return (
                <div
                  key={idx}
                  className="p-3 bg-black text-xs text-white space-y-2 rounded-none"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] border-b border-neutral-800 pb-1.5">
                    <span className="font-bold">
                      {route.departure_port_name} &rarr; {route.arrival_port_name}
                    </span>
                    <span className="font-bold">
                      {isAir
                        ? `[AIR: ${route.sea_distance_km} km | ~${route.sea_transit_hours} hrs]`
                        : `[SEA: ${route.sea_distance_km} km | ~${route.sea_transit_hours} hrs]`}
                    </span>
                  </div>

                  <div className="text-[11px]">
                    Fulfilling: <strong className="font-bold">{route.target_store_name}</strong> with{' '}
                    <strong className="font-bold">{route.quantity} units P{route.product_id}</strong>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-neutral-900">
                    <span>Carrier Surcharge:</span>
                    <span className="font-bold">
                      MYR {route.estimated_carrier_cost_myr.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
