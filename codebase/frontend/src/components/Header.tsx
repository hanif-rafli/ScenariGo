import React from 'react';
import { ExternalLink } from 'lucide-react';

interface HeaderProps {
  backendOnline?: boolean;
  activeScenarioName: string;
}

export const Header: React.FC<HeaderProps> = ({ activeScenarioName }) => {
  return (
    <header className="bg-black border-b border-neutral-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 font-mono">
      <div>
        <h1 className="text-base font-bold tracking-widest uppercase text-white">
          ScenariGo
        </h1>
        <p className="text-xs text-neutral-400">
          Discrete Optimization & Multi-Modal Logistics Simulation
        </p>
      </div>

      <div className="flex items-center space-x-5">
        <div className="text-right">
          <div className="text-[10px] uppercase text-neutral-500 tracking-wider">Active Scenario</div>
          <div className="text-xs text-white font-semibold">{activeScenarioName}</div>
        </div>

        <div className="h-5 w-px bg-neutral-800" />

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center space-x-1.5 px-3 py-1 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white rounded text-xs text-neutral-300 hover:text-white transition-colors"
        >
          <span>Docs</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </header>
  );
};
