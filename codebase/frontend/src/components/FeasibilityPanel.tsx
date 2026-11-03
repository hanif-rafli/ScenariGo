import React from 'react';
import { Stage1Result } from '../types/simulation';
import { Check, AlertCircle, Package } from 'lucide-react';

interface FeasibilityPanelProps {
  result: Stage1Result | null;
  loading: boolean;
}

export const FeasibilityPanel: React.FC<FeasibilityPanelProps> = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-6 text-center animate-pulse">
        <div className="text-xs font-mono text-neutral-400">
          [ENGINE: EVALUATING STAGE 1 GLOBAL FEASIBILITY...]
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-black border border-neutral-800 rounded-lg p-6 text-center">
        <Package className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
        <div className="text-xs font-mono text-neutral-300 uppercase tracking-wider">
          No Feasibility Evaluation Active
        </div>
        <div className="text-[11px] font-mono text-neutral-500 mt-1">
          Select a preset scenario and execute the evaluation routine.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black border border-neutral-800 rounded-lg p-5 shadow-2xl space-y-4">
      {/* Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center space-x-2">
          {result.is_feasible ? (
            <div className="flex items-center space-x-2 px-3 py-1 rounded bg-white text-black font-mono text-xs font-bold tracking-wider">
              <Check className="w-4 h-4 stroke-[3]" />
              <span>[VERIFIED: STAGE 1 FEASIBLE]</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-1 rounded bg-neutral-900 border border-red-500 text-red-400 font-mono text-xs font-bold tracking-wider">
              <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              <span>[FAIL: INVENTORY DEFICIT]</span>
            </div>
          )}
        </div>

        <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
          Stage 1 Early Cutoff Check
        </div>
      </div>

      {/* Summary Audit Text */}
      <div
        className={`p-3 rounded border text-xs font-mono leading-relaxed ${
          result.is_feasible
            ? 'bg-neutral-950 border-neutral-700 text-white'
            : 'bg-neutral-950 border-red-900/60 text-red-300'
        }`}
      >
        {result.summary}
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-neutral-950 border border-neutral-800 p-3 rounded">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
            Products Checked
          </div>
          <div className="text-xl font-bold text-white font-mono mt-1">
            {result.total_products_checked}
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 p-3 rounded">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
            Total Demand Units
          </div>
          <div className="text-xl font-bold text-white font-mono mt-1">
            {result.total_requested_units}
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 p-3 rounded">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
            Total Supply Units
          </div>
          <div className="text-xl font-bold text-white font-mono mt-1">
            {result.total_available_units}
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 p-3 rounded">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
            Deficits Count
          </div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              result.deficits_count > 0 ? 'text-red-400 font-extrabold' : 'text-white'
            }`}
          >
            {result.deficits_count}
          </div>
        </div>
      </div>

      {/* Granular Actionable Audit Badges per Product */}
      <div className="space-y-2 pt-1">
        <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          Product Audit Tokens:
        </div>

        <div className="space-y-1.5">
          {result.tokens.map((token) => {
            const isDeficit = token.status !== 'FEASIBLE';
            return (
              <div
                key={token.product_id}
                className={`p-3 rounded border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono ${
                  isDeficit
                    ? 'bg-neutral-950 border-red-900/80 text-white'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isDeficit
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-neutral-800 text-white border border-neutral-700'
                    }`}
                  >
                    P{token.product_id}
                  </span>
                  <span className={isDeficit ? 'text-red-200' : 'text-neutral-200'}>
                    {token.token_text}
                  </span>
                </div>

                <div className="flex items-center space-x-4 text-right shrink-0">
                  <span className="text-neutral-400 text-[11px]">
                    Req: <strong className="text-white">{token.requested}</strong>
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    Avail: <strong className="text-white">{token.available}</strong>
                  </span>
                  {token.deficit > 0 && (
                    <span className="text-red-400 font-bold text-[11px]">
                      Shortfall: -{token.deficit}
                    </span>
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
