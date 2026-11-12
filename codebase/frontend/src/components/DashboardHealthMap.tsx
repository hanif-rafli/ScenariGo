import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import {
  Building2,
  Store as StoreIcon,
  Anchor,
  Plane,
  X,
  RotateCcw,
} from 'lucide-react';
import { Warehouse, Store, ProductItem, AllocationItem } from '../types/simulation';

interface DashboardHealthMapProps {
  warehouses: Warehouse[];
  stores: Store[];
  products?: ProductItem[];
  allocations?: AllocationItem[];
  selectedNode: { type: 'warehouse' | 'store'; id: number } | null;
  onSelectNode: (node: { type: 'warehouse' | 'store'; id: number } | null) => void;
  filteredProductSku?: string; // 'ALL' or specific product_id e.g. '0'
}

const DEFAULT_PRODUCT_NAMES: Record<string, string> = {
  '0': 'Premium Paper Cartons (A4)',
  '1': 'Commercial Ink Cartridges',
  '2': 'Archive Filing Cabinets',
};

const resolveProductName = (pid: string, productsList: ProductItem[] = []): string => {
  const found = productsList.find((p) => p.product_id === pid);
  if (found?.name) return found.name;
  if (DEFAULT_PRODUCT_NAMES[pid]) return DEFAULT_PRODUCT_NAMES[pid];
  return `Product ${pid}`;
};

// Internal Map Pan Controller
const MapPanController: React.FC<{ target: [number, number] | null }> = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 8, { duration: 0.8 });
    }
  }, [map, target]);
  return null;
};

// Reset Camera Button
const MapResetButton: React.FC<{ onReset: () => void; isVisible: boolean }> = ({ onReset, isVisible }) => {
  const map = useMap();
  if (!isVisible) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        map.flyTo([3.8, 108.5], 6, { duration: 0.8 });
        onReset();
      }}
      className="absolute top-3 left-12 z-[1000] px-2.5 py-1 bg-black/95 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 text-[10px] font-mono font-bold flex items-center space-x-1.5 shadow-xl transition-colors cursor-pointer"
      title="Reset camera to Malaysia Overview"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      <span>[RESET VIEW]</span>
    </button>
  );
};

export const DashboardHealthMap: React.FC<DashboardHealthMapProps> = ({
  warehouses,
  stores,
  products = [],
  allocations = [],
  selectedNode,
  onSelectNode,
  filteredProductSku = 'ALL',
}) => {
  const defaultCenter: [number, number] = [3.8, 108.5];
  const defaultZoom = 6;

  // Build product threshold lookup
  const thresholdMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.product_id, p.low_stock_threshold);
    }
    return map;
  }, [products]);

  // Compute allocated quantities per warehouse and store
  const { allocatedByWarehouse, deliveredByStore } = useMemo(() => {
    const whMap = new Map<number, Record<string, number>>();
    const stMap = new Map<number, Record<string, number>>();

    for (const a of allocations) {
      if (a.quantity <= 0) continue;
      if (filteredProductSku !== 'ALL' && a.product_id !== filteredProductSku) continue;

      // Warehouse outflow
      if (!whMap.has(a.source_id)) whMap.set(a.source_id, {});
      const curWh = whMap.get(a.source_id)!;
      curWh[a.product_id] = (curWh[a.product_id] || 0) + a.quantity;

      // Store inflow
      if (!stMap.has(a.target_id)) stMap.set(a.target_id, {});
      const curSt = stMap.get(a.target_id)!;
      curSt[a.product_id] = (curSt[a.product_id] || 0) + a.quantity;
    }

    return { allocatedByWarehouse: whMap, deliveredByStore: stMap };
  }, [allocations, filteredProductSku]);

  // Compute selected facility coordinates for camera panning
  const panTargetCoords = useMemo<[number, number] | null>(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'warehouse') {
      const w = warehouses.find((item) => item.warehouse_id === selectedNode.id);
      return w ? [w.latitude, w.longitude] : null;
    }
    if (selectedNode.type === 'store') {
      const s = stores.find((item) => item.store_id === selectedNode.id);
      return s ? [s.latitude, s.longitude] : null;
    }
    return null;
  }, [selectedNode, warehouses, stores]);

  // Selected entities for the docked inspection drawer
  const selectedWarehouse = useMemo(() => {
    if (selectedNode?.type === 'warehouse') {
      return warehouses.find((w) => w.warehouse_id === selectedNode.id) || null;
    }
    return null;
  }, [selectedNode, warehouses]);

  const selectedStore = useMemo(() => {
    if (selectedNode?.type === 'store') {
      return stores.find((s) => s.store_id === selectedNode.id) || null;
    }
    return null;
  }, [selectedNode, stores]);

  // Create health icon for Warehouse
  const createWarehouseHealthIcon = (w: Warehouse) => {
    const alloc = allocatedByWarehouse.get(w.warehouse_id) || {};
    let initialTotal = 0;
    let allocatedTotal = 0;
    let hasDepleted = false;
    let hasLowStock = false;

    for (const [pid, qty] of Object.entries(w.inventory)) {
      if (filteredProductSku !== 'ALL' && pid !== filteredProductSku) continue;
      initialTotal += qty;
      const dispatched = alloc[pid] || 0;
      allocatedTotal += dispatched;
      const remaining = Math.max(0, qty - dispatched);
      const thresh = thresholdMap.get(pid) ?? 15;

      if (remaining === 0 && qty > 0) hasDepleted = true;
      else if (remaining <= thresh) hasLowStock = true;
    }

    const remainingTotal = Math.max(0, initialTotal - allocatedTotal);
    const healthStatus: 'DEPLETED' | 'LOW' | 'HEALTHY' =
      initialTotal === 0 || hasDepleted || remainingTotal === 0
        ? 'DEPLETED'
        : hasLowStock
        ? 'LOW'
        : 'HEALTHY';

    const statusColor =
      healthStatus === 'DEPLETED' ? '#ef4444' : healthStatus === 'LOW' ? '#f59e0b' : '#10b981';

    const isSelected = selectedNode?.type === 'warehouse' && selectedNode.id === w.warehouse_id;

    const iconSvg = w.is_airport ? (
      <Plane className="w-3.5 h-3.5 text-purple-400 shrink-0" />
    ) : w.is_port ? (
      <Anchor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
    ) : (
      <Building2 className="w-3.5 h-3.5 text-white shrink-0" />
    );

    const html = `
      <div class="relative cursor-pointer transition-transform duration-150 inline-flex items-center select-none" style="transform: translate(-50%, -50%);">
        <div style="border: 2px solid ${statusColor}; background-color: #000000; box-shadow: 0 0 ${isSelected ? '14px' : '4px'} ${statusColor};" 
             class="flex items-center px-2 py-1 gap-1.5 text-[10px] font-mono font-bold text-white whitespace-nowrap shadow-xl">
          <div class="flex items-center justify-center shrink-0">${renderToString(iconSvg)}</div>
          <span class="max-w-[140px] truncate">${w.name}</span>
          <span style="color: ${statusColor};" class="font-mono text-[9px] font-bold shrink-0">
            ${remainingTotal}/${initialTotal}
          </span>
        </div>
        ${isSelected ? `<div style="background-color: ${statusColor};" class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45"></div>` : ''}
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-facility-health-marker',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  // Create health icon for Store
  const createStoreHealthIcon = (s: Store) => {
    const delivered = deliveredByStore.get(s.store_id) || {};
    let requestedTotal = 0;
    let deliveredTotal = 0;

    for (const [pid, req] of Object.entries(s.requests)) {
      if (filteredProductSku !== 'ALL' && pid !== filteredProductSku) continue;
      requestedTotal += req;
      deliveredTotal += delivered[pid] || 0;
    }

    const shortfall = Math.max(0, requestedTotal - deliveredTotal);
    const isSatisfied = shortfall === 0;
    const statusColor = isSatisfied ? '#10b981' : '#ef4444';
    const isSelected = selectedNode?.type === 'store' && selectedNode.id === s.store_id;

    const html = `
      <div class="relative cursor-pointer transition-transform duration-150 inline-flex items-center select-none" style="transform: translate(-50%, -50%);">
        <div style="border: 2px solid ${statusColor}; background-color: #000000; box-shadow: 0 0 ${isSelected ? '14px' : '4px'} ${statusColor};" 
             class="flex items-center px-2 py-1 gap-1.5 text-[10px] font-mono font-bold text-white whitespace-nowrap shadow-xl">
          <div class="flex items-center justify-center shrink-0">${renderToString(<StoreIcon className="w-3.5 h-3.5 text-white shrink-0" />)}</div>
          <span class="max-w-[140px] truncate">${s.name}</span>
          <span style="color: ${statusColor};" class="font-mono text-[9px] font-bold shrink-0">
            ${isSatisfied ? '100%' : `-${shortfall}`}
          </span>
        </div>
        ${isSelected ? `<div style="background-color: ${statusColor};" class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45"></div>` : ''}
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-facility-health-marker',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  // Compute active dependency tether polylines based on selection
  const activeTethers = useMemo(() => {
    if (!selectedNode) return [];

    const whCoords = new Map(warehouses.map((w) => [w.warehouse_id, [w.latitude, w.longitude] as [number, number]]));
    const stCoords = new Map(stores.map((s) => [s.store_id, [s.latitude, s.longitude] as [number, number]]));

    const tethers: {
      id: string;
      positions: [number, number][];
      label: string;
      product_id: string;
      product_name: string;
      quantity: number;
    }[] = [];

    for (const a of allocations) {
      if (a.quantity <= 0) continue;
      if (filteredProductSku !== 'ALL' && a.product_id !== filteredProductSku) continue;

      const matchesStore = selectedNode.type === 'store' && selectedNode.id === a.target_id;
      const matchesWarehouse = selectedNode.type === 'warehouse' && selectedNode.id === a.source_id;

      if (matchesStore || matchesWarehouse) {
        const fromPos = whCoords.get(a.source_id);
        const toPos = stCoords.get(a.target_id);

        if (fromPos && toPos) {
          const path =
            a.path_coordinates && a.path_coordinates.length > 1
              ? a.path_coordinates
              : [fromPos, toPos];

          const prodName = resolveProductName(a.product_id, products);
          tethers.push({
            id: `${a.allocation_id}-${a.source_id}->${a.target_id}`,
            positions: path,
            label: `${a.source_name} -> ${a.target_name}: ${a.quantity} units ${prodName}`,
            product_id: a.product_id,
            product_name: prodName,
            quantity: a.quantity,
          });
        }
      }
    }

    return tethers;
  }, [selectedNode, allocations, warehouses, stores, filteredProductSku, products]);

  return (
    <div className="relative w-full h-[580px] border border-neutral-800 bg-black font-mono overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={3}
        maxZoom={18}
        scrollWheelZoom={true}
        className="w-full h-full bg-black"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          keepBuffer={6}
        />

        {/* Camera Pan Controller */}
        <MapPanController target={panTargetCoords} />

        {/* Reset Camera View Button */}
        <MapResetButton onReset={() => onSelectNode(null)} isVisible={Boolean(selectedNode)} />

        {/* Dynamic Dependency Tethers */}
        {activeTethers.map((tether) => (
          <Polyline
            key={tether.id}
            positions={tether.positions}
            pathOptions={{
              color: '#ffffff',
              weight: 3.5,
              opacity: 0.95,
              dashArray: '6, 6',
            }}
          />
        ))}

        {/* Warehouse Nodes */}
        {warehouses.map((w) => (
          <Marker
            key={`wh-${w.warehouse_id}`}
            position={[w.latitude, w.longitude]}
            icon={createWarehouseHealthIcon(w)}
            eventHandlers={{
              click: () => {
                const isCurrent = selectedNode?.type === 'warehouse' && selectedNode.id === w.warehouse_id;
                onSelectNode(isCurrent ? null : { type: 'warehouse', id: w.warehouse_id });
              },
            }}
          />
        ))}

        {/* Store Nodes */}
        {stores.map((s) => (
          <Marker
            key={`st-${s.store_id}`}
            position={[s.latitude, s.longitude]}
            icon={createStoreHealthIcon(s)}
            eventHandlers={{
              click: () => {
                const isCurrent = selectedNode?.type === 'store' && selectedNode.id === s.store_id;
                onSelectNode(isCurrent ? null : { type: 'store', id: s.store_id });
              },
            }}
          />
        ))}
      </MapContainer>

      {/* DOCKED FACILITY INSPECTION CARD: STORE */}
      {selectedStore && (
        <div className="absolute top-3 right-3 bottom-3 w-84 sm:w-96 z-[1000] bg-black/95 backdrop-blur-md border border-neutral-700 flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
          {/* Card Header */}
          <div className="p-3 border-b border-neutral-800 bg-neutral-950 flex items-start justify-between gap-2">
            <div className="flex items-start space-x-2 min-w-0">
              <div className="p-1.5 bg-neutral-900 border border-neutral-700 mt-0.5 shrink-0">
                <StoreIcon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-white text-sm leading-tight truncate">{selectedStore.name}</h4>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-neutral-400">
                  <span className="px-1 py-0.2 bg-neutral-900 border border-neutral-800 text-neutral-300">
                    {selectedStore.longitude < 105.0 ? 'Peninsular Malaysia' : 'East Malaysia (Borneo)'}
                  </span>
                  <span>{selectedStore.latitude.toFixed(2)}N, {selectedStore.longitude.toFixed(2)}E</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="p-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700 transition-colors cursor-pointer shrink-0"
              title="Close Inspection Card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Fulfillment Summary KPI Strip */}
          {(() => {
            const delivered = deliveredByStore.get(selectedStore.store_id) || {};
            let totalReq = 0;
            let totalDeliv = 0;
            for (const [pid, req] of Object.entries(selectedStore.requests)) {
              totalReq += req;
              totalDeliv += delivered[pid] || 0;
            }
            const shortfall = Math.max(0, totalReq - totalDeliv);
            const isSatisfied = shortfall === 0;
            const pct = totalReq > 0 ? Math.min(100, (totalDeliv / totalReq) * 100) : 100;

            return (
              <div className="p-3 border-b border-neutral-800 bg-neutral-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">Retail Fulfillment</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 font-bold border ${
                      isSatisfied
                        ? 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
                        : 'border-red-800 bg-red-950/60 text-red-300'
                    }`}
                  >
                    {isSatisfied ? '[100% SATISFIED]' : `[SHORTFALL: -${shortfall} UNITS]`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-300">
                  <span>Delivered: <strong className="text-white">{totalDeliv}</strong> / {totalReq} units</span>
                  <span className="font-bold">{pct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-neutral-900 h-2 border border-neutral-800 overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full ${isSatisfied ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                </div>
              </div>
            );
          })()}

          {/* Scrollable Itemized Product Requests */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold border-b border-neutral-800 pb-1">
              Requested Products Breakdown
            </div>

            {Object.entries(selectedStore.requests).map(([pid, req]) => {
              const delivered = (deliveredByStore.get(selectedStore.store_id) || {})[pid] || 0;
              const shortfall = Math.max(0, req - delivered);
              const prodName = resolveProductName(pid, products);
              const pct = req > 0 ? Math.min(100, (delivered / req) * 100) : 100;

              // Find supplying warehouses for this product
              const suppliers = allocations.filter(
                (a) => a.target_id === selectedStore.store_id && a.product_id === pid && a.quantity > 0
              );

              return (
                <div key={pid} className="p-2.5 bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-white leading-tight">{prodName}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 shrink-0 font-bold border ${
                        shortfall > 0
                          ? 'border-red-800 bg-red-950 text-red-300'
                          : 'border-emerald-800 bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {shortfall > 0 ? `-${shortfall} Deficit` : '[OK]'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Delivered: <strong className="text-white">{delivered}</strong> / {req}</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>

                  <div className="w-full bg-neutral-900 h-1.5 border border-neutral-800 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${shortfall > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    />
                  </div>

                  {/* Supplying Warehouse Attribution */}
                  <div className="pt-1 border-t border-neutral-900 text-[10px] space-y-1">
                    <div className="text-neutral-500 uppercase">Supplying Hub(s):</div>
                    {suppliers.length > 0 ? (
                      suppliers.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-neutral-300 pl-1">
                          <span className="truncate max-w-[180px]">&bull; {s.source_name}</span>
                          <span className="font-bold text-white shrink-0">{s.quantity} units</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-red-400 italic pl-1">[No supply allocated - Deficit]</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOCKED FACILITY INSPECTION CARD: WAREHOUSE */}
      {selectedWarehouse && (
        <div className="absolute top-3 right-3 bottom-3 w-84 sm:w-96 z-[1000] bg-black/95 backdrop-blur-md border border-neutral-700 flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
          {/* Card Header */}
          <div className="p-3 border-b border-neutral-800 bg-neutral-950 flex items-start justify-between gap-2">
            <div className="flex items-start space-x-2 min-w-0">
              <div className="p-1.5 bg-neutral-900 border border-neutral-700 mt-0.5 shrink-0">
                {selectedWarehouse.is_airport ? (
                  <Plane className="w-4 h-4 text-purple-400" />
                ) : selectedWarehouse.is_port ? (
                  <Anchor className="w-4 h-4 text-sky-400" />
                ) : (
                  <Building2 className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-white text-sm leading-tight truncate">{selectedWarehouse.name}</h4>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-neutral-400">
                  <span className="px-1 py-0.2 bg-neutral-900 border border-neutral-800 text-neutral-300">
                    {selectedWarehouse.is_airport
                      ? 'Air Cargo Hub'
                      : selectedWarehouse.is_port
                      ? 'Port Bonded Depot'
                      : 'Inland Highway Hub'}
                  </span>
                  <span>{selectedWarehouse.latitude.toFixed(2)}N, {selectedWarehouse.longitude.toFixed(2)}E</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="p-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700 transition-colors cursor-pointer shrink-0"
              title="Close Inspection Card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Warehouse Reserve Health KPI Strip */}
          {(() => {
            const alloc = allocatedByWarehouse.get(selectedWarehouse.warehouse_id) || {};
            let initTotal = 0;
            let allocTotal = 0;
            let hasDepleted = false;
            let hasLowStock = false;

            for (const [pid, init] of Object.entries(selectedWarehouse.inventory)) {
              initTotal += init;
              const dispatched = alloc[pid] || 0;
              allocTotal += dispatched;
              const rem = Math.max(0, init - dispatched);
              const thresh = thresholdMap.get(pid) ?? 15;
              if (rem === 0 && init > 0) hasDepleted = true;
              else if (rem <= thresh) hasLowStock = true;
            }

            const remTotal = Math.max(0, initTotal - allocTotal);
            const reservePct = initTotal > 0 ? (remTotal / initTotal) * 100 : 0;
            const statusLabel = hasDepleted ? '[DEPLETED]' : hasLowStock ? '[LOW STOCK]' : '[HEALTHY]';
            const statusColor = hasDepleted
              ? 'border-red-800 bg-red-950/60 text-red-300'
              : hasLowStock
              ? 'border-amber-800 bg-amber-950/60 text-amber-300'
              : 'border-emerald-800 bg-emerald-950/60 text-emerald-300';

            return (
              <div className="p-3 border-b border-neutral-800 bg-neutral-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">Stock Reserve Health</span>
                  <span className={`text-[10px] px-1.5 py-0.5 font-bold border ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-300">
                  <span>Reserve: <strong className="text-white">{remTotal}</strong> / {initTotal} units</span>
                  <span>Dispatched: <strong className="text-white">{allocTotal}</strong></span>
                </div>
                <div className="w-full bg-neutral-900 h-2 border border-neutral-800 overflow-hidden">
                  <div
                    style={{ width: `${reservePct}%` }}
                    className={`h-full ${hasDepleted ? 'bg-red-500' : hasLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  />
                </div>
              </div>
            );
          })()}

          {/* Scrollable Itemized Product Inventory */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold border-b border-neutral-800 pb-1">
              Inventory Reserves Breakdown
            </div>

            {Object.entries(selectedWarehouse.inventory).map(([pid, init]) => {
              const dispatched = (allocatedByWarehouse.get(selectedWarehouse.warehouse_id) || {})[pid] || 0;
              const rem = Math.max(0, init - dispatched);
              const prodName = resolveProductName(pid, products);
              const thresh = thresholdMap.get(pid) ?? 15;
              const isOut = rem === 0;
              const isLow = rem <= thresh;
              const reservePct = init > 0 ? (rem / init) * 100 : 0;

              // Find outbound recipient stores for this product
              const outbound = allocations.filter(
                (a) => a.source_id === selectedWarehouse.warehouse_id && a.product_id === pid && a.quantity > 0
              );

              return (
                <div key={pid} className="p-2.5 bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-white leading-tight">{prodName}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 shrink-0 font-bold border ${
                        isOut
                          ? 'border-red-800 bg-red-950 text-red-300'
                          : isLow
                          ? 'border-amber-800 bg-amber-950 text-amber-300'
                          : 'border-emerald-800 bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {isOut ? '[DEPLETED]' : isLow ? '[LOW STOCK]' : '[HEALTHY]'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Reserve: <strong className="text-white">{rem}</strong> / {init}</span>
                    <span>Dispatched: <strong className="text-white">{dispatched}</strong></span>
                  </div>

                  <div className="w-full bg-neutral-900 h-1.5 border border-neutral-800 overflow-hidden">
                    <div
                      style={{ width: `${reservePct}%` }}
                      className={`h-full ${isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    />
                  </div>

                  {/* Outbound Store Deliveries Attribution */}
                  <div className="pt-1 border-t border-neutral-900 text-[10px] space-y-1">
                    <div className="text-neutral-500 uppercase">Outbound Deliveries:</div>
                    {outbound.length > 0 ? (
                      outbound.map((o, idx) => (
                        <div key={idx} className="flex items-center justify-between text-neutral-300 pl-1">
                          <span className="truncate max-w-[180px]">&bull; {o.target_name}</span>
                          <span className="font-bold text-white shrink-0">{o.quantity} units</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-neutral-500 italic pl-1">No outbound shipments allocated</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Spatial Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-black/95 backdrop-blur-sm border border-neutral-800 p-2 text-[10px] space-y-1 font-mono shadow-xl pointer-events-none">
        <div className="font-bold text-white uppercase tracking-wider pb-1 border-b border-neutral-800">
          Facility Health Status
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-none shrink-0" />
          <span className="text-white">Healthy Stock / 100% Satisfied</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-amber-500 rounded-none shrink-0" />
          <span className="text-white">Low Reserve (&le; Alert Threshold)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-none shrink-0" />
          <span className="text-white">Depleted Reserve / Retail Shortfall</span>
        </div>
      </div>
    </div>
  );
};
