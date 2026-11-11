import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import { Building2, Store as StoreIcon, Anchor, Plane } from 'lucide-react';
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
      // Filter by product SKU if selected
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
      <Plane className="w-3.5 h-3.5 text-purple-400" />
    ) : w.is_port ? (
      <Anchor className="w-3.5 h-3.5 text-sky-400" />
    ) : (
      <Building2 className="w-3.5 h-3.5 text-white" />
    );

    const html = `
      <div class="relative cursor-pointer transition-transform duration-150 ${isSelected ? 'scale-110' : ''}">
        <div style="border: 2px solid ${statusColor}; background-color: #000000; box-shadow: 0 0 ${isSelected ? '12px' : '4px'} ${statusColor};" 
             class="flex items-center px-1.5 py-1 gap-1 text-[10px] font-mono font-bold text-white whitespace-nowrap">
          <div class="flex items-center justify-center">${renderToString(iconSvg)}</div>
          <span>W${w.warehouse_id}</span>
          <span style="color: ${statusColor};" class="font-mono text-[9px] font-bold">
            ${remainingTotal}/${initialTotal}
          </span>
        </div>
        ${isSelected ? `<div style="background-color: ${statusColor};" class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rotate-45"></div>` : ''}
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-warehouse-health-marker',
      iconSize: [68, 26],
      iconAnchor: [34, 13],
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
      <div class="relative cursor-pointer transition-transform duration-150 ${isSelected ? 'scale-110' : ''}">
        <div style="border: 2px solid ${statusColor}; background-color: #000000; box-shadow: 0 0 ${isSelected ? '12px' : '4px'} ${statusColor};" 
             class="flex items-center px-1.5 py-1 gap-1 text-[10px] font-mono font-bold text-white whitespace-nowrap">
          <div class="flex items-center justify-center">${renderToString(<StoreIcon className="w-3.5 h-3.5 text-white" />)}</div>
          <span>S${s.store_id}</span>
          <span style="color: ${statusColor};" class="font-mono text-[9px] font-bold">
            ${isSatisfied ? '100%' : `-${shortfall}`}
          </span>
        </div>
        ${isSelected ? `<div style="background-color: ${statusColor};" class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rotate-45"></div>` : ''}
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-store-health-marker',
      iconSize: [68, 26],
      iconAnchor: [34, 13],
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
          const path = a.path_coordinates && a.path_coordinates.length > 1
            ? a.path_coordinates
            : [fromPos, toPos];

          tethers.push({
            id: `${a.allocation_id}-${a.source_id}->${a.target_id}`,
            positions: path,
            label: `${a.source_name} -> ${a.target_name}: ${a.quantity} units P${a.product_id}`,
            product_id: a.product_id,
            quantity: a.quantity,
          });
        }
      }
    }

    return tethers;
  }, [selectedNode, allocations, warehouses, stores, filteredProductSku]);

  return (
    <div className="relative w-full h-[540px] border border-neutral-800 bg-black font-mono">
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

        {/* Dynamic Dependency Tethers */}
        {activeTethers.map((tether) => (
          <Polyline
            key={tether.id}
            positions={tether.positions}
            pathOptions={{
              color: '#ffffff',
              weight: 3.5,
              opacity: 0.9,
              dashArray: '6, 6',
            }}
          >
            <Popup>
              <div className="p-1 font-mono text-white text-xs">
                <div className="font-bold border-b border-neutral-700 pb-1 mb-1">Active Supply Tether</div>
                <div>{tether.label}</div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Warehouse Nodes */}
        {warehouses.map((w) => (
          <Marker
            key={`wh-${w.warehouse_id}`}
            position={[w.latitude, w.longitude]}
            icon={createWarehouseHealthIcon(w)}
            eventHandlers={{
              click: () => onSelectNode({ type: 'warehouse', id: w.warehouse_id }),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[200px] font-mono text-white">
                <div className="font-bold text-xs border-b border-neutral-700 pb-1 mb-1 flex items-center justify-between">
                  <span>{w.name}</span>
                  <span className="text-[10px] text-neutral-400">W{w.warehouse_id}</span>
                </div>
                <div className="text-[11px] text-neutral-400 mb-1">
                  Location: {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                </div>
                <div className="text-[11px] font-bold text-neutral-300 mt-2 mb-1 border-t border-neutral-800 pt-1">
                  Stock Health Breakdown:
                </div>
                <div className="space-y-1">
                  {Object.entries(w.inventory).map(([pid, qty]) => {
                    const dispatched = (allocatedByWarehouse.get(w.warehouse_id) || {})[pid] || 0;
                    const remaining = Math.max(0, qty - dispatched);
                    const thresh = thresholdMap.get(pid) ?? 15;
                    const isLow = remaining <= thresh;
                    const isOut = remaining === 0;

                    return (
                      <div key={pid} className="flex justify-between items-center text-[10px] bg-neutral-900 px-1.5 py-0.5">
                        <span>P{pid}</span>
                        <span>Init: {qty} | Alloc: {dispatched} | Res: {remaining}</span>
                        <span className={isOut ? 'text-red-400 font-bold' : isLow ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                          {isOut ? '[DEPLETED]' : isLow ? '[LOW]' : '[OK]'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Store Nodes */}
        {stores.map((s) => (
          <Marker
            key={`st-${s.store_id}`}
            position={[s.latitude, s.longitude]}
            icon={createStoreHealthIcon(s)}
            eventHandlers={{
              click: () => onSelectNode({ type: 'store', id: s.store_id }),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[200px] font-mono text-white">
                <div className="font-bold text-xs border-b border-neutral-700 pb-1 mb-1 flex items-center justify-between">
                  <span>{s.name}</span>
                  <span className="text-[10px] text-neutral-400">S{s.store_id}</span>
                </div>
                <div className="text-[11px] text-neutral-400 mb-1">
                  Location: {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                </div>
                <div className="text-[11px] font-bold text-neutral-300 mt-2 mb-1 border-t border-neutral-800 pt-1">
                  Store Requests & Fulfillment:
                </div>
                <div className="space-y-1">
                  {Object.entries(s.requests).map(([pid, req]) => {
                    const delivered = (deliveredByStore.get(s.store_id) || {})[pid] || 0;
                    const shortfall = Math.max(0, req - delivered);

                    return (
                      <div key={pid} className="flex justify-between items-center text-[10px] bg-neutral-900 px-1.5 py-0.5">
                        <span>P{pid}</span>
                        <span>Req: {req} | Deliv: {delivered}</span>
                        <span className={shortfall > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {shortfall > 0 ? `[-${shortfall}]` : '[100%]'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Spatial Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-black/90 backdrop-blur-sm border border-neutral-800 p-2 text-[10px] space-y-1 font-mono">
        <div className="font-bold text-white uppercase tracking-wider pb-1 border-b border-neutral-800">
          Spatial Health Encoding
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-none" />
          <span className="text-white">Healthy / 100% Satisfied</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-amber-500 rounded-none" />
          <span className="text-white">Low Reserve (&le; Threshold)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-none" />
          <span className="text-white">Depleted / Stock Shortfall</span>
        </div>
        <div className="flex items-center space-x-2 pt-1 border-t border-neutral-900 text-neutral-400">
          <span>Click facility to display supply dependency tethers</span>
        </div>
      </div>
    </div>
  );
};
