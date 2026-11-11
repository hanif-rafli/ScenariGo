import React from 'react';

export type AppView = 'dashboard' | 'simulator' | 'graph' | 'organization';

interface HeaderProps {
  activeScenarioName: string;
  isModified?: boolean;
  activeView?: AppView;
  onChangeView?: (view: AppView) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScenarioName,
  isModified,
  activeView = 'dashboard',
  onChangeView,
}) => {
  return (
    <header className="bg-black border-b border-neutral-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 font-mono">
      <div className="flex items-center space-x-6">
        <div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-white">
            ScenariGo
          </h1>
          <p className="text-[11px] text-neutral-400 tracking-tight">
            Discrete Optimization & Multi-Modal Logistics Simulation
          </p>
        </div>

        {/* View Switcher: Dashboard, Simulator, Graph View, Organization */}
        <div className="flex items-center space-x-1 bg-neutral-950 p-0.5 border border-neutral-800">
          <button
            type="button"
            onClick={() => onChangeView?.('dashboard')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer rounded-none ${
              activeView === 'dashboard'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            DASHBOARD
          </button>
          <button
            type="button"
            onClick={() => onChangeView?.('simulator')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer rounded-none ${
              activeView === 'simulator'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            SIMULATOR
          </button>
          <button
            type="button"
            onClick={() => onChangeView?.('graph')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer rounded-none ${
              activeView === 'graph'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            GRAPH VIEW
          </button>
          <button
            type="button"
            onClick={() => onChangeView?.('organization')}
            className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer rounded-none ${
              activeView === 'organization'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            ORGANIZATION
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-5">
        <button
          type="button"
          onClick={() => onChangeView?.('organization')}
          className="text-right hover:opacity-80 transition-opacity cursor-pointer group"
          title="Click to configure in Organization console"
        >
          <div className="flex items-center justify-end space-x-1.5 text-[10px] uppercase text-neutral-400 tracking-wider">
            <span>Active Scenario</span>
            {isModified && (
              <span className="text-[9px] text-amber-400 font-bold">[MODIFIED]</span>
            )}
          </div>
          <div className="text-xs text-white font-semibold group-hover:underline">
            {activeScenarioName} &rarr;
          </div>
        </button>

        <div className="h-4 w-px bg-neutral-800" />

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1 bg-neutral-950 hover:bg-white hover:text-black text-xs text-white border border-neutral-800 transition-colors uppercase font-bold rounded-none"
        >
          [DOCS]
        </a>
      </div>
    </header>
  );
};
