import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { NetworkFlowGraphTrace, GraphNode, GraphIterationStep, GraphEdgeSnapshot } from '../types/simulation';

interface GraphViewProps {
  circulationTrace?: NetworkFlowGraphTrace;
  bipartiteTrace?: NetworkFlowGraphTrace;
  loading?: boolean;
}

type NetworkType = 'CIRCULATION' | 'BIPARTITE';
type ViewMode = 'FLOW' | 'RESIDUAL' | 'SIDE_BY_SIDE';

interface NodePosition {
  x: number;
  y: number;
}

export const GraphView: React.FC<GraphViewProps> = ({
  circulationTrace,
  bipartiteTrace,
  loading = false,
}) => {
  // 1. Selection State
  const [activeNetwork, setActiveNetwork] = useState<NetworkType>('CIRCULATION');
  const [viewMode, setViewMode] = useState<ViewMode>('FLOW');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Pan and Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Get active trace based on selected network
  const activeTrace = useMemo(() => {
    if (activeNetwork === 'CIRCULATION') {
      return circulationTrace;
    }
    return bipartiteTrace;
  }, [activeNetwork, circulationTrace, bipartiteTrace]);

  const steps: GraphIterationStep[] = activeTrace?.steps ?? [];
  const nodes: GraphNode[] = activeTrace?.nodes ?? [];
  const currentStep: GraphIterationStep | undefined = steps[currentStepIndex] || steps[0];

  // Reset step index and selected node when changing network
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setSelectedNodeId(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activeNetwork]);

  // Timeline Playback Timer
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, steps.length]);

  // Topological Layout Algorithm (Left to Right Layers)
  const nodePositions = useMemo<Record<string, NodePosition>>(() => {
    if (!nodes || nodes.length === 0) return {};

    // Group nodes by layer
    const layerMap: Record<number, GraphNode[]> = {};
    for (const node of nodes) {
      if (!layerMap[node.layer]) {
        layerMap[node.layer] = [];
      }
      layerMap[node.layer].push(node);
    }

    const layers = Object.keys(layerMap)
      .map(Number)
      .sort((a, b) => a - b);
    const positions: Record<string, NodePosition> = {};

    const layerSpacingX = 175;
    const nodeSpacingY = 85;
    const startX = 90;
    const centerY = 330;

    for (const layer of layers) {
      const layerNodes = layerMap[layer];
      const count = layerNodes.length;
      const x = startX + layer * layerSpacingX;

      layerNodes.forEach((node, idx) => {
        const yOffset = (idx - (count - 1) / 2) * nodeSpacingY;
        positions[node.node_id] = {
          x,
          y: centerY + yOffset,
        };
      });
    }

    return positions;
  }, [nodes]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.node_id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // Canvas Mouse Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-element') || (e.target as HTMLElement).closest('.floating-card')) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(Math.max(0.4, prev + delta), 2.5));
  };

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNodeId(null);
  }, []);

  // Helper to render directed edges for a specific mode
  const renderGraphCanvas = (mode: 'FLOW' | 'RESIDUAL', widthClass: string = 'w-full') => {
    if (!currentStep) return null;

    const augmentingPathEdges = new Set(currentStep.augmenting_path_edges || []);
    const augmentingPathNodes = new Set(currentStep.augmenting_path_nodes || []);

    return (
      <div className={`relative h-[620px] bg-black overflow-hidden select-none border border-neutral-900 ${widthClass}`}>
        {/* Mode Watermark Header */}
        <div className="absolute top-3 left-4 z-10 text-[10px] uppercase tracking-widest font-bold text-white bg-black/80 px-2 py-1 border border-neutral-800">
          {mode === 'FLOW' ? 'Physical Flow View (flow / capacity)' : 'Residual Graph View (forward / backward capacity)'}
        </div>

        <svg
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <defs>
            {/* Standard Directed Arrow Marker */}
            <marker
              id={`arrow-standard-${mode}`}
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ffffff" />
            </marker>

            {/* Augmenting Path Highlight Arrow Marker */}
            <marker
              id={`arrow-highlight-${mode}`}
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" stroke="#ffffff" strokeWidth="1" />
            </marker>

            {/* Backward Residual Edge Arrow Marker */}
            <marker
              id={`arrow-residual-rev-${mode}`}
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#a3a3a3" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* 1. EDGES LAYER */}
            {currentStep.edges.map((edge: GraphEdgeSnapshot, idx: number) => {
              const uPos = nodePositions[edge.source];
              const vPos = nodePositions[edge.target];
              if (!uPos || !vPos) return null;

              const isAugmenting = augmentingPathEdges.has(edge.edge_id);

              if (mode === 'FLOW') {
                // FLOW VIEW: Show forward edges with flow and capacity
                // Skip circulation return edge if zero flow to avoid clutter
                if (edge.edge_type === 'CIRCULATION_RETURN' && edge.flow === 0) {
                  return null;
                }

                const midX = (uPos.x + vPos.x) / 2;
                const midY = (uPos.y + vPos.y) / 2;

                const labelText =
                  edge.cost_myr !== null && edge.cost_myr !== undefined
                    ? `${edge.flow}/${edge.capacity} (MYR ${edge.cost_myr.toFixed(0)})`
                    : edge.edge_type === 'CIRCULATION_RETURN'
                    ? `return: ${edge.flow}`
                    : `${edge.flow}/${edge.capacity}`;

                return (
                  <g key={`flow-edge-${edge.edge_id}-${idx}`}>
                    <line
                      x1={uPos.x}
                      y1={uPos.y}
                      x2={vPos.x}
                      y2={vPos.y}
                      stroke="#ffffff"
                      strokeWidth={isAugmenting ? 2.5 : edge.flow > 0 ? 1.6 : 0.8}
                      strokeDasharray={isAugmenting ? '4, 4' : edge.flow === 0 ? '2, 3' : undefined}
                      markerEnd={isAugmenting ? `url(#arrow-highlight-${mode})` : `url(#arrow-standard-${mode})`}
                      opacity={isAugmenting ? 1.0 : edge.flow > 0 ? 0.9 : 0.35}
                    />
                    {/* Edge Label along path */}
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-30"
                        y="-8"
                        width="60"
                        height="16"
                        fill="#000000"
                        stroke={isAugmenting ? '#ffffff' : '#333333'}
                        strokeWidth="0.8"
                      />
                      <text
                        x="0"
                        y="3"
                        fill="#ffffff"
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                        fontWeight={isAugmenting ? 'bold' : 'normal'}
                      >
                        {labelText}
                      </text>
                    </g>
                  </g>
                );
              } else {
                // RESIDUAL VIEW:
                // Show forward residual edge if residual_forward > 0
                // Show backward cancelable edge if residual_backward > 0
                const elements = [];

                // A. Forward residual capacity: u -> v
                if (edge.residual_forward > 0) {
                  const midX = (uPos.x + vPos.x) / 2;
                  const midY = (uPos.y + vPos.y) / 2 - 8;

                  elements.push(
                    <g key={`res-fwd-${edge.edge_id}-${idx}`}>
                      <line
                        x1={uPos.x}
                        y1={uPos.y - 2}
                        x2={vPos.x}
                        y2={vPos.y - 2}
                        stroke="#ffffff"
                        strokeWidth={isAugmenting ? 2.2 : 1.2}
                        strokeDasharray={isAugmenting ? '4, 4' : undefined}
                        markerEnd={`url(#arrow-standard-${mode})`}
                        opacity={isAugmenting ? 1.0 : 0.85}
                      />
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect x="-22" y="-7" width="44" height="14" fill="#000000" stroke="#333333" strokeWidth="0.7" />
                        <text
                          x="0"
                          y="3"
                          fill="#ffffff"
                          fontSize="8"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          res: {edge.residual_forward}
                        </text>
                      </g>
                    </g>
                  );
                }

                // B. Backward residual edge: v -> u (curve offset)
                if (edge.residual_backward > 0) {
                  // Quadratic bezier curve offset downwards
                  const dx = vPos.x - uPos.x;
                  const dy = vPos.y - uPos.y;
                  const cx = (uPos.x + vPos.x) / 2 - dy * 0.15;
                  const cy = (uPos.y + vPos.y) / 2 + dx * 0.15 + 16;
                  const pathD = `M ${vPos.x} ${vPos.y} Q ${cx} ${cy} ${uPos.x} ${uPos.y}`;

                  elements.push(
                    <g key={`res-rev-${edge.edge_id}-${idx}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#a3a3a3"
                        strokeWidth="1.2"
                        strokeDasharray="3, 3"
                        markerEnd={`url(#arrow-residual-rev-${mode})`}
                        opacity={0.8}
                      />
                      <g transform={`translate(${cx}, ${cy})`}>
                        <rect x="-22" y="-7" width="44" height="14" fill="#000000" stroke="#444444" strokeWidth="0.7" />
                        <text
                          x="0"
                          y="3"
                          fill="#a3a3a3"
                          fontSize="8"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          rev: {edge.residual_backward}
                        </text>
                      </g>
                    </g>
                  );
                }

                return elements;
              }
            })}

            {/* 2. NODES LAYER */}
            {nodes.map((node: GraphNode) => {
              const pos = nodePositions[node.node_id];
              if (!pos) return null;

              const isSelected = selectedNodeId === node.node_id;
              const isAugmentingNode = augmentingPathNodes.has(node.node_id);
              const isSource = node.node_type === 'SUPER_SOURCE' || node.node_type === 'SOURCE';
              const isSink = node.node_type === 'SUPER_SINK' || node.node_type === 'SINK';

              return (
                <g
                  key={`node-${node.node_id}`}
                  className="node-element cursor-pointer"
                  onClick={() => setSelectedNodeId(node.node_id)}
                >
                  {/* Outer Ring / Dotted Ring */}
                  {isSource ? (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="22"
                      fill="#000000"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeDasharray="3, 3"
                    />
                  ) : isSink ? (
                    <>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="23"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r="19"
                        fill="#000000"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </>
                  ) : (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="19"
                      fill="#000000"
                      stroke="#ffffff"
                      strokeWidth={isSelected || isAugmentingNode ? '2.5' : '1.5'}
                    />
                  )}

                  {/* Selected / Augmenting Node Highlight Halo */}
                  {isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r="26"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  )}

                  {/* Node Short Label */}
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    fill="#ffffff"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {node.short_label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Node Inspector Card (anchored relative to selected node) */}
        {selectedNode && nodePositions[selectedNode.node_id] && (
          <div
            className="floating-card absolute z-20 bg-black border border-white p-3.5 shadow-2xl font-mono text-white text-xs w-72 rounded-none space-y-2 pointer-events-auto"
            style={{
              left: Math.max(
                20,
                Math.min(
                  nodePositions[selectedNode.node_id].x * zoom + pan.x - 140,
                  window.innerWidth > 1000 ? 500 : 250
                )
              ),
              top: Math.max(
                45,
                Math.min(nodePositions[selectedNode.node_id].y * zoom + pan.y - 120, 400)
              ),
            }}
          >
            <div className="flex items-start justify-between border-b border-neutral-800 pb-1.5">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase tracking-widest block">
                  [{selectedNode.node_type}] LAYER {selectedNode.layer}
                </span>
                <span className="font-bold text-sm tracking-wide">
                  {selectedNode.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="text-white hover:bg-white hover:text-black px-1.5 py-0.5 text-xs font-bold cursor-pointer rounded-none border border-neutral-800"
                title="Close Inspector"
              >
                X
              </button>
            </div>

            {/* Node Metadata Key-Value List */}
            <div className="space-y-1 text-[11px] max-h-48 overflow-y-auto">
              <div className="flex justify-between border-b border-neutral-900 pb-0.5">
                <span className="text-neutral-400">Node Identifier:</span>
                <span className="font-bold">{selectedNode.node_id}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-900 pb-0.5">
                <span className="text-neutral-400">Short Label:</span>
                <span className="font-bold">{selectedNode.short_label}</span>
              </div>

              {Object.entries(selectedNode.metadata).map(([key, val]) => (
                <div key={key} className="flex justify-between border-b border-neutral-900 pb-0.5 text-[11px]">
                  <span className="text-neutral-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-bold text-right">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))}
            </div>

            {/* Incident Edges Flow Summary */}
            <div className="pt-1 border-t border-neutral-900 text-[10px]">
              <span className="text-neutral-400 block uppercase tracking-wider mb-1">
                Active Step Incident Flows:
              </span>
              <div className="space-y-0.5">
                {currentStep.edges
                  .filter((e) => e.source === selectedNode.node_id || e.target === selectedNode.node_id)
                  .map((e) => (
                    <div key={e.edge_id} className="flex justify-between">
                      <span>{e.source === selectedNode.node_id ? `Out -> ${e.target}` : `In <- ${e.source}`}</span>
                      <span className="font-bold">
                        flow: {e.flow}/{e.capacity} {e.cost_myr ? `(MYR ${e.cost_myr})` : ''}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 font-mono text-white">
      {/* 1. TOP CONTROL BAR (Matching Reference Screenshot) */}
      <div className="bg-black border-b border-neutral-800 pb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Network Selection Tabs */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveNetwork('CIRCULATION')}
            className={`px-3 py-1.5 font-bold uppercase transition-colors cursor-pointer rounded-none ${
              activeNetwork === 'CIRCULATION'
                ? 'bg-white text-black'
                : 'text-white hover:bg-neutral-900'
            }`}
          >
            [CIRCULATION WITH DEMANDS]
          </button>
          <button
            onClick={() => setActiveNetwork('BIPARTITE')}
            className={`px-3 py-1.5 font-bold uppercase transition-colors cursor-pointer rounded-none ${
              activeNetwork === 'BIPARTITE'
                ? 'bg-white text-black'
                : 'text-white hover:bg-neutral-900'
            }`}
          >
            [BIPARTITE MIN-COST FLOW]
          </button>
        </div>

        {/* Center: View Mode (Flow / Residual / Side by Side) */}
        <div className="flex items-center space-x-1 border border-neutral-800 p-0.5">
          <button
            onClick={() => setViewMode('FLOW')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer rounded-none ${
              viewMode === 'FLOW' ? 'bg-white text-black' : 'text-white hover:bg-neutral-900'
            }`}
          >
            FLOW GRAPH
          </button>
          <button
            onClick={() => setViewMode('RESIDUAL')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer rounded-none ${
              viewMode === 'RESIDUAL' ? 'bg-white text-black' : 'text-white hover:bg-neutral-900'
            }`}
          >
            RESIDUAL GRAPH
          </button>
          <button
            onClick={() => setViewMode('SIDE_BY_SIDE')}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer rounded-none ${
              viewMode === 'SIDE_BY_SIDE' ? 'bg-white text-black' : 'text-white hover:bg-neutral-900'
            }`}
          >
            SIDE BY SIDE
          </button>
        </div>

        {/* Right: Canvas Actions & Status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="px-2 py-1 bg-black hover:bg-neutral-900 border border-neutral-800 text-[11px] text-white rounded-none cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="px-2 py-1 bg-black hover:bg-neutral-900 border border-neutral-800 text-[11px] text-white rounded-none cursor-pointer"
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={resetView}
              className="px-2.5 py-1 bg-black hover:bg-neutral-900 border border-neutral-800 text-[11px] text-white rounded-none cursor-pointer uppercase"
            >
              AUTO-LAYOUT
            </button>
          </div>

          <span className="text-[10px] uppercase tracking-wider text-neutral-400 hidden xl:inline">
            APPLIED TOPOLOGICAL LEFT-TO-RIGHT AUTO-LAYOUT
          </span>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: CANVAS + TIMELINE SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Canvas Area (9 cols or full) */}
        <div className="lg:col-span-9 space-y-2">
          {loading ? (
            <div className="h-[620px] bg-black border border-neutral-900 flex items-center justify-center">
              <div className="text-xs text-white uppercase tracking-widest animate-pulse">
                Generating discrete optimization execution trace...
              </div>
            </div>
          ) : viewMode === 'SIDE_BY_SIDE' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {renderGraphCanvas('FLOW')}
              {renderGraphCanvas('RESIDUAL')}
            </div>
          ) : (
            renderGraphCanvas(viewMode)
          )}
        </div>

        {/* 3. TIMELINE SIDEBAR (3 cols) */}
        <div className="lg:col-span-3 bg-neutral-950 p-4 space-y-4 rounded-none border border-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">
                Iteration Timeline
              </span>
              <span className="text-[10px] text-neutral-400">
                Step {currentStepIndex} of {Math.max(0, steps.length - 1)}
              </span>
            </div>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black text-[11px] font-bold uppercase rounded-none cursor-pointer"
            >
              {isPlaying ? 'PAUSE' : 'PLAY FROM BEGINNING'}
            </button>
          </div>

          {/* Current Step Active Card */}
          {currentStep && (
            <div className="bg-black p-3 space-y-2 text-xs border border-neutral-800 rounded-none">
              <div className="font-bold text-[11px] uppercase tracking-wide">
                {currentStep.label}
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-300">
                {currentStep.description}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-900 text-[10px]">
                <div>
                  <span className="text-neutral-500 block">Bottleneck Flow</span>
                  <span className="font-bold">+{currentStep.bottleneck_flow} units</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Cumulative Flow</span>
                  <span className="font-bold">{currentStep.cumulative_flow} units</span>
                </div>
                {activeNetwork === 'BIPARTITE' && (
                  <div className="col-span-2 pt-1 border-t border-neutral-900 flex justify-between">
                    <span className="text-neutral-500">Cumulative Fleet Cost</span>
                    <span className="font-bold">MYR {currentStep.cumulative_cost_myr.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Scrubber */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={Math.max(0, steps.length - 1)}
              value={currentStepIndex}
              onChange={(e) => {
                setCurrentStepIndex(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-white cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
              <span>Step 0 (Init)</span>
              <span>Final (Optimal)</span>
            </div>
          </div>

          {/* Step History Manifest List */}
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
              Augmentation Step Manifest:
            </div>
            {steps.map((st, idx) => (
              <div
                key={`step-list-${idx}`}
                onClick={() => {
                  setCurrentStepIndex(idx);
                  setIsPlaying(false);
                }}
                className={`p-2 text-xs font-mono cursor-pointer transition-colors rounded-none ${
                  currentStepIndex === idx
                    ? 'bg-white text-black font-bold'
                    : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span>Step {st.step_index}</span>
                  <span>{st.bottleneck_flow > 0 ? `+${st.bottleneck_flow} units` : 'Setup'}</span>
                </div>
                <div className="text-[11px] truncate mt-0.5">
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
