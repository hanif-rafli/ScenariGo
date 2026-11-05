import React from 'react';
import { Stage1Result } from '../types/simulation';

interface FeasibilityPanelProps {
  result: Stage1Result | null;
  loading: boolean;
}

export const FeasibilityPanel: React.FC<FeasibilityPanelProps> = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="bg-neutral-950 p-6 text-center animate-pulse rounded-none">
        <div className="text-xs font-mono text-white">
          [ENGINE: EVALUATING STAGE 1 GLOBAL FEASIBILITY...]
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-neutral-950 p-6 text-center rounded-none font-mono">
        <div className="text-xs text-white uppercase tracking-wider font-bold">
          No Feasibility Evaluation Active
        </div>
        <div className="text-[11px] text-white mt-1">
          Select a preset scenario and execute the evaluation routine.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 p-5 space-y-4 rounded-none font-mono">
      {/* Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center space-x-2">
          {result.is_feasible ? (
            <div className="px-3 py-1 bg-white text-black text-xs font-bold tracking-wider rounded-none">
              [VERIFIED: STAGE 1 FEASIBLE]
            </div>
          ) : (
            <div className="px-3 py-1 bg-black border border-white text-white text-xs font-bold tracking-wider rounded-none">
              [FAIL: INVENTORY DEFICIT]
            </div>
          )}
        </div>

        <div className="text-[10px] text-white uppercase tracking-wider">
          Stage 1 Early Cutoff Check
        </div>
      </div>

      {/* Summary Audit Text */}
      <div className="p-3 bg-black text-xs text-white leading-relaxed rounded-none">
        {result.summary}
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-black p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">
            Products Checked
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {result.total_products_checked}
          </div>
        </div>

        <div className="bg-black p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">
            Total Demand Units
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {result.total_requested_units}
          </div>
        </div>

        <div className="bg-black p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">
            Total Supply Units
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {result.total_available_units}
          </div>
        </div>

        <div className="bg-black p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">
            Deficits Count
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {result.deficits_count}
          </div>
        </div>
      </div>

      {/* Granular Actionable Audit Badges per Product */}
      <div className="space-y-2 pt-1">
        <div className="text-[10px] uppercase tracking-widest text-white">
          Product Audit Tokens:
        </div>

        <div className="space-y-1.5">
          {result.tokens.map((token) => {
            const isDeficit = token.status !== 'FEASIBLE';
            return (
              <div
                key={token.product_id}
                className="p-3 bg-black flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-white rounded-none"
              >
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-none ${
                      isDeficit ? 'bg-white text-black' : 'bg-neutral-900 text-white'
                    }`}
                  >
                    P{token.product_id}
                  </span>
                  <span>{token.token_text}</span>
                </div>

                <div className="flex items-center space-x-4 text-right shrink-0 text-white text-[11px]">
                  <span>Req: <strong className="font-bold">{token.requested}</strong></span>
                  <span>Avail: <strong className="font-bold">{token.available}</strong></span>
                  {token.deficit > 0 && (
                    <span className="font-bold">[Shortfall: -{token.deficit}]</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
