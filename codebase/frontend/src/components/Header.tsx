import React from 'react';

interface HeaderProps {
  backendOnline?: boolean;
  activeScenarioName: string;
  activeView?: 'simulator' | 'fleet' | 'graph';
  onChangeView?: (view: 'simulator' | 'fleet' | 'graph') => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScenarioName,
  activeView = 'simulator',
  onChangeView,
}) => {
  return (
    <header className="bg-black border-b border-neutral-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 font-mono">
      <div className="flex items-center space-x-6">
        <div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-white">
            ScenariGo
          </h1>
          <p className="text-[11px] text-white tracking-tight">
            Discrete Optimization & Multi-Modal Logistics Simulation
          </p>
        </div>

        {/* View Switcher: Simulator, Manage Fleet, Graph View */}
        <div className="flex items-center space-x-1 bg-neutral-950 p-0.5">
          <button
            type="button"
            onClick={() => onChangeView?.('simulator')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer rounded-none ${
              activeView === 'simulator'
                ? 'bg-white text-black'
                : 'text-white hover:bg-neutral-900'
            }`}
          >
            SIMULATOR
          </button>
          <button
            type="button"
            onClick={() => onChangeView?.('fleet')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer rounded-none ${
              activeView === 'fleet'
                ? 'bg-white text-black'
                : 'text-white hover:bg-neutral-900'
            }`}
          >
            MANAGE FLEET
          </button>
          <button
            type="button"
            onClick={() => onChangeView?.('graph')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer rounded-none ${
              activeView === 'graph'
                ? 'bg-white text-black'
                : 'text-white hover:bg-neutral-900'
            }`}
          >
            GRAPH VIEW
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-5">
        <div className="text-right">
          <div className="text-[10px] uppercase text-white tracking-wider">Active Scenario</div>
          <div className="text-xs text-white font-semibold">{activeScenarioName}</div>
        </div>

        <div className="h-4 w-px bg-neutral-800" />

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1 bg-neutral-950 hover:bg-white hover:text-black text-xs text-white transition-colors uppercase font-bold rounded-none"
        >
          [DOCS]
        </a>
      </div>
    </header>
  );
};
