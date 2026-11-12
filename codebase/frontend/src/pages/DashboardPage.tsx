import React, { useState, useMemo } from 'react';
import {
  SimulationRequest,
  Stage3Result,
  Stage4Result,
  TruckInstance,
  ProductItem,
} from '../types/simulation';
import { DashboardHealthMap } from '../components/DashboardHealthMap';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Truck,
  Box,
  Layers,
  MapPin,
  Building2,
  Store as StoreIcon,
} from 'lucide-react';

interface DashboardPageProps {
  scenario: SimulationRequest;
  flowResult: Stage3Result | null;
  stage4Result: Stage4Result | null;
  fleet: TruckInstance[];
  onSelectStore?: (storeId: number) => void;
  onSelectWarehouse?: (warehouseId: number) => void;
}

const DEFAULT_PRODUCT_CATALOG: ProductItem[] = [
  { product_id: '0', name: 'Premium Paper Cartons (A4)', sku: 'P0-PAPER-A4', category: 'Office Supplies', unit_weight_kg: 15.0, low_stock_threshold: 20 },
  { product_id: '1', name: 'Commercial Ink Cartridges', sku: 'P1-INK-CART', category: 'Office Supplies', unit_weight_kg: 2.5, low_stock_threshold: 15 },
  { product_id: '2', name: 'Archive Filing Cabinets', sku: 'P2-ARCH-CAB', category: 'Storage & Hardware', unit_weight_kg: 35.0, low_stock_threshold: 10 },
];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  scenario,
  flowResult,
  stage4Result,
  fleet,
}) => {
  // Granularity & Display Controls
  const [regionFilter, setRegionFilter] = useState<'GLOBAL' | 'PENINSULAR' | 'BORNEO'>('GLOBAL');
  const [skuFilter, setSkuFilter] = useState<string>('ALL');
  const [healthFilter, setHealthFilter] = useState<'ALL' | 'AT_RISK'>('ALL');
  const [viewMode, setViewMode] = useState<'SPLIT' | 'MAP' | 'MATRIX'>('SPLIT');

  // Selected Facility for Synchronized Drill-Down
  const [selectedNode, setSelectedNode] = useState<{ type: 'warehouse' | 'store'; id: number } | null>(null);

  // Products lookup with robust fallback catalog
  const products = useMemo<ProductItem[]>(() => {
    if (scenario.products && scenario.products.length > 0) {
      return scenario.products;
    }
    return DEFAULT_PRODUCT_CATALOG;
  }, [scenario.products]);

  const productMap = useMemo(() => {
    const map = new Map<string, { name: string; threshold: number; weight: number }>();
    for (const p of products) {
      map.set(p.product_id, {
        name: p.name,
        threshold: p.low_stock_threshold,
        weight: p.unit_weight_kg,
      });
    }
    for (const def of DEFAULT_PRODUCT_CATALOG) {
      if (!map.has(def.product_id)) {
        map.set(def.product_id, {
          name: def.name,
          threshold: def.low_stock_threshold,
          weight: def.unit_weight_kg,
        });
      }
    }
    return map;
  }, [products]);

  const getProductName = (pid: string): string => {
    return productMap.get(pid)?.name || `Product ${pid}`;
  };

  // Landmass helper
  const isPeninsular = (lon: number) => lon < 105.0;

  // Filtered Warehouses and Stores by Region
  const filteredWarehouses = useMemo(() => {
    return scenario.warehouses.filter((w) => {
      if (regionFilter === 'PENINSULAR') return isPeninsular(w.longitude);
      if (regionFilter === 'BORNEO') return !isPeninsular(w.longitude);
      return true;
    });
  }, [scenario.warehouses, regionFilter]);

  const filteredStores = useMemo(() => {
    return scenario.stores.filter((s) => {
      if (regionFilter === 'PENINSULAR') return isPeninsular(s.longitude);
      if (regionFilter === 'BORNEO') return !isPeninsular(s.longitude);
      return true;
    });
  }, [scenario.stores, regionFilter]);

  // Allocation mapping
  const allocations = flowResult?.allocations || [];

  const { allocatedByWarehouse, deliveredByStore, supplyingWarehousesForStore } = useMemo(() => {
    const whAlloc = new Map<number, Record<string, number>>();
    const stDeliv = new Map<number, Record<string, number>>();
    const storeSupplyMap = new Map<number, Map<string, { whId: number; whName: string; qty: number }[]>>();

    for (const a of allocations) {
      if (a.quantity <= 0) continue;

      // Warehouse outflow
      if (!whAlloc.has(a.source_id)) whAlloc.set(a.source_id, {});
      const wRecord = whAlloc.get(a.source_id)!;
      wRecord[a.product_id] = (wRecord[a.product_id] || 0) + a.quantity;

      // Store inflow
      if (!stDeliv.has(a.target_id)) stDeliv.set(a.target_id, {});
      const sRecord = stDeliv.get(a.target_id)!;
      sRecord[a.product_id] = (sRecord[a.product_id] || 0) + a.quantity;

      // Store supply sources breakdown
      if (!storeSupplyMap.has(a.target_id)) storeSupplyMap.set(a.target_id, new Map());
      const pMap = storeSupplyMap.get(a.target_id)!;
      if (!pMap.has(a.product_id)) pMap.set(a.product_id, []);
      pMap.get(a.product_id)!.push({ whId: a.source_id, whName: a.source_name, qty: a.quantity });
    }

    return {
      allocatedByWarehouse: whAlloc,
      deliveredByStore: stDeliv,
      supplyingWarehousesForStore: storeSupplyMap,
    };
  }, [allocations]);

  // Calculate Overall Operational Health Metrics
  const kpis = useMemo(() => {
    let totalDemand = 0;
    let totalDelivered = 0;
    let storesWithDeficit = 0;

    for (const s of scenario.stores) {
      let storeHasDeficit = false;
      const delivered = deliveredByStore.get(s.store_id) || {};
      for (const [pid, req] of Object.entries(s.requests)) {
        if (skuFilter !== 'ALL' && pid !== skuFilter) continue;
        totalDemand += req;
        const deliv = delivered[pid] || 0;
        totalDelivered += deliv;
        if (deliv < req) storeHasDeficit = true;
      }
      if (storeHasDeficit) storesWithDeficit++;
    }

    let warehousesAtRisk = 0;
    let totalInitialSupply = 0;
    let totalRemainingSupply = 0;

    for (const w of scenario.warehouses) {
      const allocated = allocatedByWarehouse.get(w.warehouse_id) || {};
      let whAtRisk = false;
      for (const [pid, init] of Object.entries(w.inventory)) {
        if (skuFilter !== 'ALL' && pid !== skuFilter) continue;
        totalInitialSupply += init;
        const dispatched = allocated[pid] || 0;
        const remaining = Math.max(0, init - dispatched);
        totalRemainingSupply += remaining;
        const thresh = productMap.get(pid)?.threshold ?? 15;
        if (remaining <= thresh) whAtRisk = true;
      }
      if (whAtRisk) warehousesAtRisk++;
    }

    const fulfillmentRate = totalDemand > 0 ? (totalDelivered / totalDemand) * 100 : 100;
    const activeDispatches = (stage4Result?.itineraries || []).length;

    return {
      totalDemand,
      totalDelivered,
      fulfillmentRate,
      storesWithDeficit,
      warehousesAtRisk,
      totalInitialSupply,
      totalRemainingSupply,
      activeDispatches,
    };
  }, [scenario, deliveredByStore, allocatedByWarehouse, skuFilter, productMap, stage4Result]);

  // Filter facilities by Health Status if requested
  const visibleWarehouses = useMemo(() => {
    if (healthFilter === 'ALL') return filteredWarehouses;
    return filteredWarehouses.filter((w) => {
      const alloc = allocatedByWarehouse.get(w.warehouse_id) || {};
      return Object.entries(w.inventory).some(([pid, init]) => {
        if (skuFilter !== 'ALL' && pid !== skuFilter) return false;
        const remaining = Math.max(0, init - (alloc[pid] || 0));
        const thresh = productMap.get(pid)?.threshold ?? 15;
        return remaining <= thresh;
      });
    });
  }, [filteredWarehouses, healthFilter, allocatedByWarehouse, skuFilter, productMap]);

  const visibleStores = useMemo(() => {
    if (healthFilter === 'ALL') return filteredStores;
    return filteredStores.filter((s) => {
      const deliv = deliveredByStore.get(s.store_id) || {};
      return Object.entries(s.requests).some(([pid, req]) => {
        if (skuFilter !== 'ALL' && pid !== skuFilter) return false;
        return (deliv[pid] || 0) < req;
      });
    });
  }, [filteredStores, healthFilter, deliveredByStore, skuFilter]);

  // Selected Store Object for Drill-Down
  const selectedStoreObj = useMemo(() => {
    if (selectedNode?.type === 'store') {
      return scenario.stores.find((s) => s.store_id === selectedNode.id) || null;
    }
    return null;
  }, [selectedNode, scenario.stores]);

  // Selected Warehouse Object for Drill-Down
  const selectedWarehouseObj = useMemo(() => {
    if (selectedNode?.type === 'warehouse') {
      return scenario.warehouses.find((w) => w.warehouse_id === selectedNode.id) || null;
    }
    return null;
  }, [selectedNode, scenario.warehouses]);

  return (
    <div className="space-y-6 font-mono text-white">
      {/* 1. Header & Operational KPI Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider">
            Operational Health & Demand Telemetry
          </h2>
          <p className="text-xs text-neutral-400">
            Real-time fulfillment metrics, warehouse reserve exhaustion, and retail store replenishment health
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-neutral-400">Active Scenario:</span>
          <span className="font-bold bg-neutral-900 px-2.5 py-1 border border-neutral-700">
            {scenario.scenario_name}
          </span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-neutral-950 p-3 border border-neutral-800">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Fulfillment Rate</span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${kpis.fulfillmentRate === 100 ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className="text-2xl font-bold mt-1">
            {kpis.fulfillmentRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {kpis.totalDelivered} / {kpis.totalDemand} units
          </div>
        </div>

        <div className="bg-neutral-950 p-3 border border-neutral-800">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Stores with Deficit</span>
            <TrendingDown className={`w-3.5 h-3.5 ${kpis.storesWithDeficit > 0 ? 'text-red-400' : 'text-neutral-500'}`} />
          </div>
          <div className={`text-2xl font-bold mt-1 ${kpis.storesWithDeficit > 0 ? 'text-red-400' : 'text-white'}`}>
            {kpis.storesWithDeficit}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            of {scenario.stores.length} retail outlets
          </div>
        </div>

        <div className="bg-neutral-950 p-3 border border-neutral-800">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Warehouses At Risk</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${kpis.warehousesAtRisk > 0 ? 'text-amber-400' : 'text-neutral-500'}`} />
          </div>
          <div className={`text-2xl font-bold mt-1 ${kpis.warehousesAtRisk > 0 ? 'text-amber-400' : 'text-white'}`}>
            {kpis.warehousesAtRisk}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            of {scenario.warehouses.length} storage hubs
          </div>
        </div>

        <div className="bg-neutral-950 p-3 border border-neutral-800">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Remaining Reserve</span>
            <Box className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-2xl font-bold mt-1">
            {kpis.totalRemainingSupply}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            of {kpis.totalInitialSupply} total capacity
          </div>
        </div>

        <div className="bg-neutral-950 p-3 border border-neutral-800">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Active Dispatches</span>
            <Truck className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-2xl font-bold mt-1">
            {kpis.activeDispatches}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {fleet.length} total fleet capacity
          </div>
        </div>
      </div>

      {/* 2. Operational Control & Filter Ribbon */}
      <div className="bg-neutral-950 p-3 border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Region Granularity */}
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-400 uppercase text-[10px] tracking-wider">Region:</span>
            <div className="flex border border-neutral-700">
              {(['GLOBAL', 'PENINSULAR', 'BORNEO'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className={`px-2 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                    regionFilter === r ? 'bg-white text-black' : 'bg-black text-white hover:bg-neutral-900'
                  }`}
                >
                  {r === 'GLOBAL' ? 'All (Global)' : r === 'PENINSULAR' ? 'Peninsular' : 'Borneo'}
                </button>
              ))}
            </div>
          </div>

          {/* Product Filter Granularity */}
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-400 uppercase text-[10px] tracking-wider">Product:</span>
            <div className="flex border border-neutral-700">
              <button
                onClick={() => setSkuFilter('ALL')}
                className={`px-2 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  skuFilter === 'ALL' ? 'bg-white text-black' : 'bg-black text-white hover:bg-neutral-900'
                }`}
              >
                All Products
              </button>
              {products.map((p) => (
                <button
                  key={p.product_id}
                  onClick={() => setSkuFilter(p.product_id)}
                  className={`px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                    skuFilter === p.product_id ? 'bg-white text-black' : 'bg-black text-white hover:bg-neutral-900'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Health Status Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-400 uppercase text-[10px] tracking-wider">Health Filter:</span>
            <div className="flex border border-neutral-700">
              <button
                onClick={() => setHealthFilter('ALL')}
                className={`px-2 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  healthFilter === 'ALL' ? 'bg-white text-black' : 'bg-black text-white hover:bg-neutral-900'
                }`}
              >
                All Facilities
              </button>
              <button
                onClick={() => setHealthFilter('AT_RISK')}
                className={`px-2 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                  healthFilter === 'AT_RISK' ? 'bg-red-950 text-red-200 border border-red-500' : 'bg-black text-white hover:bg-neutral-900'
                }`}
              >
                At-Risk / Deficit Only
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center space-x-1 border border-neutral-700">
          {(['SPLIT', 'MAP', 'MATRIX'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                viewMode === m ? 'bg-white text-black' : 'bg-black text-white hover:bg-neutral-900'
              }`}
            >
              {m === 'SPLIT' ? '[SPLIT HYBRID]' : m === 'MAP' ? '[SPATIAL MAP]' : '[MATRIX & CHARTS]'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Operational Work area: Map + Matrices */}
      <div className="space-y-6">
        {/* Spatial Map View */}
        {(viewMode === 'SPLIT' || viewMode === 'MAP') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-neutral-400">
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-white" />
                <span>Spatial Facility Health Map & Dependency Tethers</span>
              </span>
              <span className="text-[11px]">
                Showing {visibleWarehouses.length} Warehouses | {visibleStores.length} Stores
              </span>
            </div>
            <DashboardHealthMap
              warehouses={visibleWarehouses}
              stores={visibleStores}
              products={products}
              allocations={allocations}
              selectedNode={selectedNode}
              onSelectNode={(node) => {
                setSelectedNode(node);
              }}
              filteredProductSku={skuFilter}
            />
          </div>
        )}

        {/* Analytical Matrices & Health Charts */}
        {(viewMode === 'SPLIT' || viewMode === 'MATRIX') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Store Request Health Overview */}
            <div className="bg-neutral-950 p-4 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center space-x-2">
                  <StoreIcon className="w-4 h-4 text-white" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Store Request Overview (Retail Health)
                  </h3>
                </div>
                <span className="text-[10px] text-neutral-400">
                  {visibleStores.length} stores
                </span>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {visibleStores.map((s) => {
                  const deliv = deliveredByStore.get(s.store_id) || {};
                  let reqTotal = 0;
                  let delivTotal = 0;

                  for (const [pid, req] of Object.entries(s.requests)) {
                    if (skuFilter !== 'ALL' && pid !== skuFilter) continue;
                    reqTotal += req;
                    delivTotal += deliv[pid] || 0;
                  }

                  const shortfall = Math.max(0, reqTotal - delivTotal);
                  const pct = reqTotal > 0 ? Math.min(100, (delivTotal / reqTotal) * 100) : 100;
                  const isSelected = selectedNode?.type === 'store' && selectedNode.id === s.store_id;

                  return (
                    <div
                      key={`st-card-${s.store_id}`}
                      onClick={() => {
                        setSelectedNode((prev) =>
                          prev?.type === 'store' && prev.id === s.store_id ? null : { type: 'store', id: s.store_id }
                        );
                      }}
                      className={`p-2.5 border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-white bg-neutral-900'
                          : 'border-neutral-800 bg-black hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold flex items-center space-x-1.5">
                          <span>{s.name}</span>
                          <span className="text-[9px] px-1 py-0.2 bg-neutral-900 border border-neutral-800 text-neutral-400">
                            {isPeninsular(s.longitude) ? 'Peninsular' : 'Borneo'}
                          </span>
                        </span>
                        <span className={`text-[11px] font-bold ${shortfall > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {shortfall > 0 ? `[SHORTFALL: -${shortfall}]` : '[100% SATISFIED]'}
                        </span>
                      </div>

                      {/* Stacked Fulfillment Progress Bar */}
                      <div className="w-full bg-neutral-900 h-2 rounded-none overflow-hidden my-1.5 border border-neutral-800">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full ${shortfall > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        />
                      </div>

                      {/* Per-Product Request Pill Grid */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(s.requests).map(([pid, req]) => {
                          if (skuFilter !== 'ALL' && pid !== skuFilter) return null;
                          const delivered = deliv[pid] || 0;
                          const diff = req - delivered;
                          const prodName = getProductName(pid);
                          return (
                            <span
                              key={pid}
                              className={`text-[10px] px-1.5 py-0.5 border ${
                                diff > 0
                                  ? 'border-red-800 bg-red-950/40 text-red-300'
                                  : 'border-neutral-800 bg-neutral-900 text-neutral-300'
                              }`}
                            >
                              {prodName}: {delivered}/{req} {diff > 0 ? `(-${diff})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warehouse Inventory Stock Health Report */}
            <div className="bg-neutral-950 p-4 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-white" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Warehouse Inventory Report (Supply Stress)
                  </h3>
                </div>
                <span className="text-[10px] text-neutral-400">
                  {visibleWarehouses.length} warehouses
                </span>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {visibleWarehouses.map((w) => {
                  const alloc = allocatedByWarehouse.get(w.warehouse_id) || {};
                  let initTotal = 0;
                  let allocTotal = 0;
                  let hasDepleted = false;
                  let hasLowStock = false;

                  for (const [pid, init] of Object.entries(w.inventory)) {
                    if (skuFilter !== 'ALL' && pid !== skuFilter) continue;
                    initTotal += init;
                    const dispatched = alloc[pid] || 0;
                    allocTotal += dispatched;
                    const rem = Math.max(0, init - dispatched);
                    const thresh = productMap.get(pid)?.threshold ?? 15;
                    if (rem === 0 && init > 0) hasDepleted = true;
                    else if (rem <= thresh) hasLowStock = true;
                  }

                  const remTotal = Math.max(0, initTotal - allocTotal);
                  const isSelected = selectedNode?.type === 'warehouse' && selectedNode.id === w.warehouse_id;

                  return (
                    <div
                      key={`wh-card-${w.warehouse_id}`}
                      onClick={() => {
                        setSelectedNode((prev) =>
                          prev?.type === 'warehouse' && prev.id === w.warehouse_id ? null : { type: 'warehouse', id: w.warehouse_id }
                        );
                      }}
                      className={`p-2.5 border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-white bg-neutral-900'
                          : 'border-neutral-800 bg-black hover:border-neutral-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold flex items-center space-x-1.5">
                          <span>{w.name}</span>
                          {w.is_airport ? (
                            <span className="text-[9px] px-1 py-0.2 bg-purple-950 text-purple-300 border border-purple-800">
                              [AIR]
                            </span>
                          ) : w.is_port ? (
                            <span className="text-[9px] px-1 py-0.2 bg-sky-950 text-sky-300 border border-sky-800">
                              [PORT]
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            hasDepleted
                              ? 'text-red-400'
                              : hasLowStock
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {hasDepleted ? '[DEPLETED]' : hasLowStock ? '[LOW STOCK]' : '[HEALTHY]'}
                        </span>
                      </div>

                      {/* Stock depletion ratio */}
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 my-1">
                        <span>Total Reserve: <strong className="text-white">{remTotal}</strong> / {initTotal} units</span>
                        <span>Dispatched: <strong className="text-white">{allocTotal}</strong> units</span>
                      </div>

                      {/* Stock Progress Bar */}
                      <div className="w-full bg-neutral-900 h-2 rounded-none overflow-hidden my-1.5 border border-neutral-800">
                        <div
                          style={{ width: `${initTotal > 0 ? (remTotal / initTotal) * 100 : 0}%` }}
                          className={`h-full ${
                            hasDepleted ? 'bg-red-500' : hasLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>

                      {/* Per-Product Inventory Reserve Breakdown */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(w.inventory).map(([pid, init]) => {
                          if (skuFilter !== 'ALL' && pid !== skuFilter) return null;
                          const dispatched = alloc[pid] || 0;
                          const rem = Math.max(0, init - dispatched);
                          const prodName = getProductName(pid);
                          const thresh = productMap.get(pid)?.threshold ?? 15;
                          const isLow = rem <= thresh;
                          const isOut = rem === 0;

                          return (
                            <span
                              key={pid}
                              className={`text-[10px] px-1.5 py-0.5 border ${
                                isOut
                                  ? 'border-red-800 bg-red-950/40 text-red-300 font-bold'
                                  : isLow
                                  ? 'border-amber-800 bg-amber-950/40 text-amber-300'
                                  : 'border-neutral-800 bg-neutral-900 text-neutral-300'
                              }`}
                            >
                              {prodName}: {rem}/{init} rem
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. Synchronized Facility Drill-Down Detail Drawer */}
        {selectedNode && (
          <div className="bg-neutral-950 border border-neutral-800 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Synchronized Facility Drill-Down Detail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-[11px] px-2 py-0.5 bg-black hover:bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Close Drill-Down
              </button>
            </div>

            {selectedStoreObj && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-black p-3 border border-neutral-800">
                  <div>
                    <div className="text-xs font-bold text-white uppercase">
                      {selectedStoreObj.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Coordinates: {selectedStoreObj.latitude.toFixed(4)}, {selectedStoreObj.longitude.toFixed(4)} | Landmass: {isPeninsular(selectedStoreObj.longitude) ? 'Peninsular Malaysia' : 'East Malaysia (Borneo)'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-neutral-400 uppercase">Fulfillment Status</div>
                    <div className="text-xs font-bold text-emerald-400">[ACTIVE MONITORING]</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-neutral-800">
                    <thead className="bg-neutral-900 uppercase text-[10px] text-neutral-400 border-b border-neutral-800">
                      <tr>
                        <th className="p-2">Product Name</th>
                        <th className="p-2 text-right">Requested</th>
                        <th className="p-2 text-right">Delivered</th>
                        <th className="p-2 text-right">Shortfall</th>
                        <th className="p-2">Supplying Warehouse Hub(s)</th>
                        <th className="p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 bg-black">
                      {Object.entries(selectedStoreObj.requests).map(([pid, req]) => {
                        const deliv = (deliveredByStore.get(selectedStoreObj.store_id) || {})[pid] || 0;
                        const shortfall = Math.max(0, req - deliv);
                        const prodName = getProductName(pid);
                        const sources = (supplyingWarehousesForStore.get(selectedStoreObj.store_id)?.get(pid)) || [];

                        return (
                          <tr key={pid} className="hover:bg-neutral-950">
                            <td className="p-2 font-bold text-white">{prodName}</td>
                            <td className="p-2 text-right font-bold">{req}</td>
                            <td className="p-2 text-right font-bold text-emerald-400">{deliv}</td>
                            <td className={`p-2 text-right font-bold ${shortfall > 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                              {shortfall > 0 ? `-${shortfall}` : '0'}
                            </td>
                            <td className="p-2 text-neutral-300">
                              {sources.length > 0 ? (
                                <div className="space-y-0.5">
                                  {sources.map((s, idx) => (
                                    <div key={idx} className="text-[11px]">
                                      &bull; {s.whName}: <strong>{s.qty} units</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-neutral-600 italic">No supply allocated</span>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 border ${
                                  shortfall > 0
                                    ? 'border-red-800 bg-red-950/60 text-red-300'
                                    : 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
                                }`}
                              >
                                {shortfall > 0 ? '[DEFICIT]' : '[SATISFIED]'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedWarehouseObj && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-black p-3 border border-neutral-800">
                  <div>
                    <div className="text-xs font-bold text-white uppercase">
                      {selectedWarehouseObj.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Coordinates: {selectedWarehouseObj.latitude.toFixed(4)}, {selectedWarehouseObj.longitude.toFixed(4)} | Modality:{' '}
                      {selectedWarehouseObj.is_airport
                        ? 'Airport Transshipment Hub'
                        : selectedWarehouseObj.is_port
                        ? 'Port Bonded Depot'
                        : 'Inland Highway Warehouse'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-neutral-400 uppercase">Inventory Stress</div>
                    <div className="text-xs font-bold text-amber-400">[INSPECTION]</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-neutral-800">
                    <thead className="bg-neutral-900 uppercase text-[10px] text-neutral-400 border-b border-neutral-800">
                      <tr>
                        <th className="p-2">Product Name</th>
                        <th className="p-2 text-right">Initial Inventory</th>
                        <th className="p-2 text-right">Dispatched</th>
                        <th className="p-2 text-right">Remaining Reserve</th>
                        <th className="p-2 text-right">Low-Stock Alert Level</th>
                        <th className="p-2 text-center">Depletion State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 bg-black">
                      {Object.entries(selectedWarehouseObj.inventory).map(([pid, init]) => {
                        const dispatched = (allocatedByWarehouse.get(selectedWarehouseObj.warehouse_id) || {})[pid] || 0;
                        const remaining = Math.max(0, init - dispatched);
                        const prodName = getProductName(pid);
                        const pInfo = productMap.get(pid);
                        const thresh = pInfo?.threshold ?? 15;
                        const isOut = remaining === 0;
                        const isLow = remaining <= thresh;

                        return (
                          <tr key={pid} className="hover:bg-neutral-950">
                            <td className="p-2 font-bold text-white">{prodName}</td>
                            <td className="p-2 text-right font-bold">{init}</td>
                            <td className="p-2 text-right font-bold text-neutral-400">{dispatched}</td>
                            <td className={`p-2 text-right font-bold ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {remaining}
                            </td>
                            <td className="p-2 text-right text-neutral-400">&le; {thresh} units</td>
                            <td className="p-2 text-center">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 border ${
                                  isOut
                                    ? 'border-red-800 bg-red-950/60 text-red-300 font-bold'
                                    : isLow
                                    ? 'border-amber-800 bg-amber-950/60 text-amber-300 font-bold'
                                    : 'border-emerald-800 bg-emerald-950/60 text-emerald-300'
                                }`}
                              >
                                {isOut ? '[DEPLETED]' : isLow ? '[LOW STOCK]' : '[HEALTHY]'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
