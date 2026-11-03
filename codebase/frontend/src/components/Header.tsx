import React from 'react';
import { Terminal, ExternalLink } from 'lucide-react';

interface HeaderProps {
  backendOnline: boolean;
  activeScenarioName: string;
}

export const Header: React.FC<HeaderProps> = ({ backendOnline, activeScenarioName }) => {
  return (
    <header className="bg-black border-b border-neutral-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-neutral-900 border border-neutral-700 rounded text-white">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-widest uppercase font-mono text-white">
              ScenariGo
            </h1>
            <span className="text-[10px] font-mono uppercase bg-neutral-900 text-neutral-300 border border-neutral-700 px-1.5 py-0.5 rounded">
              Engine v0.1
            </span>
          </div>
          <p className="text-xs font-mono text-neutral-400">
            Discrete Optimization & Multi-Modal Logistics Simulation
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-5">
        <div className="hidden sm:block text-right">
          <div className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider">Active Scenario</div>
          <div className="text-xs font-mono text-white font-semibold">{activeScenarioName}</div>
        </div>

        <div className="h-5 w-px bg-neutral-800 hidden sm:block" />

        <div className="flex items-center space-x-3">
          {backendOnline ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium bg-neutral-900 text-white border border-neutral-700">
              <span className="w-1.5 h-1.5 rounded-full bg-white mr-2 animate-pulse" />
              [API: ONLINE]
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 mr-2" />
              [API: OFFLINE]
            </span>
          )}

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white rounded text-xs font-mono text-neutral-300 hover:text-white transition-colors"
          >
            <span>Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </header>
  );
};
