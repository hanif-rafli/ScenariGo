import React, { useState } from 'react';
import { Stage4Result, DispatchItinerary } from '../types/simulation';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

interface FleetPanelProps {
  result: Stage4Result | null;
  loading: boolean;
  onSelectItinerary?: (itinerary: DispatchItinerary | null) => void;
  onSelectStore?: (storeId: number | string) => void;
}

export const FleetPanel: React.FC<FleetPanelProps> = ({
  result,
  loading,
  onSelectItinerary,
  onSelectStore,
}) => {
  const [expandedItinId, setExpandedItinId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-6 font-mono text-center space-y-3 shadow-2xl">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        <p className="text-xs text-neutral-400 uppercase tracking-widest">
          Solving Bipartite Min-Cost Matching and Dijkstra Road Fuel Pacing...
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-6 font-mono text-center text-xs text-neutral-500 shadow-2xl">
        Run simulation to compute fleet routing, fuel burn, and budget validation.
      </div>
    );
  }

  const toggleExpand = (itinId: string, itin: DispatchItinerary) => {
    if (expandedItinId === itinId) {
      setExpandedItinId(null);
      onSelectItinerary?.(null);
    } else {
      setExpandedItinId(itinId);
      onSelectItinerary?.(itin);
    }
  };

  return (
    <div className="bg-black border border-neutral-800 rounded-lg p-5 font-mono space-y-5 shadow-2xl">
      {/* 1. Header Status Badge */}
      <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            {result.is_budget_feasible ? (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-neutral-900 border border-white text-white text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>[VERIFIED: STAGE 4 BUDGET FEASIBLE]</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-neutral-900 border border-red-500 text-red-400 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>[FAIL: OVERBUDGET]</span>
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-300 pt-1 leading-relaxed">
            {result.summary}
          </p>
        </div>
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
          MCMF FLEET ASSIGNMENT
        </span>
      </div>

      {/* 2. Top-Level Budget & Fleet Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Total Transport</div>
          <div className={`text-base font-bold mt-0.5 ${result.is_budget_feasible ? 'text-white' : 'text-red-400'}`}>
            MYR {result.total_transport_cost_myr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Budget Cap</div>
          <div className="text-base font-bold text-white mt-0.5">
            MYR {result.budget_cap_myr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Budget Variance</div>
          <div className={`text-base font-bold mt-0.5 ${result.budget_variance_myr >= 0 ? 'text-white font-mono' : 'text-red-400'}`}>
            {result.budget_variance_myr >= 0 ? '+' : ''}MYR {result.budget_variance_myr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-neutral-950 border border-neutral-800 p-2.5 rounded">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Trucks Dispatched</div>
          <div className="text-base font-bold text-white mt-0.5">
            {result.dispatched_trucks_count} <span className="text-xs text-neutral-500 font-normal">active</span>
          </div>
        </div>
      </div>

      {/* 3. Cost Breakdown Sub-Meter */}
      <div className="bg-neutral-950 border border-neutral-800 p-3 rounded space-y-2 text-xs">
        <div className="flex justify-between items-center text-neutral-400 text-[10px] uppercase tracking-wider">
          <span>Cost Breakdown</span>
          <span>Diesel: MYR {result.total_fleet_fuel_cost_myr.toFixed(2)} | Sea Freight: MYR {result.total_maritime_cost_myr.toFixed(2)}</span>
        </div>
        <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden flex">
          <div
            className="bg-amber-400 h-full"
            style={{
              width: `${Math.min(
                (result.total_fleet_fuel_cost_myr / (result.total_transport_cost_myr || 1)) * 100,
                100
              )}%`,
            }}
            title="Road Diesel Burn"
          />
          <div
            className="bg-sky-400 h-full"
            style={{
              width: `${Math.min(
                (result.total_maritime_cost_myr / (result.total_transport_cost_myr || 1)) * 100,
                100
              )}%`,
            }}
            title="Sea Freight Surcharge"
          />
        </div>
      </div>

      {/* 4. Turn-by-Turn Vehicle Itineraries List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-900 pb-2">
          <span>Vehicle Dispatch Itineraries</span>
          <span className="text-neutral-500 font-normal text-[11px]">
            {result.itineraries.length} active routes
          </span>
        </div>

        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {result.itineraries.map((itin) => {
            const isExpanded = expandedItinId === itin.itinerary_id;

            return (
              <div
                key={itin.itinerary_id}
                className={`bg-neutral-950 border rounded transition-colors ${
                  isExpanded ? 'border-white' : 'border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {/* Itinerary Header Summary */}
                <div
                  onClick={() => toggleExpand(itin.itinerary_id, itin)}
                  className="p-3 cursor-pointer flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={itin.truck_image}
                      alt={itin.truck_name}
                      className="w-10 h-10 object-cover rounded border border-neutral-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/trucks/isuzu_3ton.jpg';
                      }}
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-bold">{itin.truck_name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-neutral-900 text-neutral-400 border border-neutral-800 rounded font-mono">
                          {itin.truck_id}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        Deliver to:{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStore?.(itin.target_store_id);
                          }}
                          className="text-white underline hover:text-cyan-400 font-bold"
                        >
                          {itin.target_store_name}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center space-x-3">
                    <div>
                      <div className="text-white font-bold font-mono">
                        MYR {itin.total_fuel_cost_myr.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {itin.total_distance_km} km | {itin.total_fuel_liters} L
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Turn-by-Turn Leg Details */}
                {isExpanded && (
                  <div className="border-t border-neutral-900 p-3 bg-black space-y-2.5 text-xs">
                    <div className="text-[10px] uppercase text-neutral-500 font-bold tracking-wider">
                      Turn-by-Turn Manifest:
                    </div>

                    <div className="space-y-1.5">
                      {itin.legs.map((leg, idx) => (
                        <div
                          key={`leg-${idx}`}
                          className="bg-neutral-950 p-2 rounded border border-neutral-800 space-y-1 text-[11px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-amber-300 font-bold">
                              {leg.leg_type === 'DEADHEAD_PICKUP' ? '[DEADHEAD: PICKUP]' : '[HAUL: DELIVER]'}
                            </span>
                            <span className="text-neutral-400 font-mono">
                              {leg.distance_km} km (~{leg.transit_hours} hrs)
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-white">
                            <span>{leg.origin_name}</span>
                            <ArrowRight className="w-3 h-3 text-neutral-500" />
                            <span className="font-bold">{leg.destination_name}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-neutral-500 pt-0.5 border-t border-neutral-900">
                            <span>Fuel Burned: {leg.fuel_burned_liters} L</span>
                            <span className="text-white font-mono font-bold">MYR {leg.fuel_cost_myr.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}

                      {itin.is_refueled && (
                        <div className="p-2 rounded bg-cyan-950/40 border border-cyan-800 text-[11px] text-cyan-300 space-y-1">
                          <div className="font-bold">Highway Refueling Stop Inserted:</div>
                          {itin.refueling_stops.map((rf, rIdx) => (
                            <div key={`rf-${rIdx}`} className="flex justify-between text-[10px]">
                              <span>{rf.station_name} ({rf.highway_name})</span>
                              <span className="font-bold font-mono">
                                +{rf.liters_refueled} L (MYR {rf.cost_myr.toFixed(2)})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Flow Audit Tokens */}
      <div className="space-y-2 border-t border-neutral-900 pt-3">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          Fleet & Budget Audit Tokens
        </div>
        <div className="space-y-1.5 max-h-[130px] overflow-y-auto pr-1">
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
