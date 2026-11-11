import React, { useState, useRef } from 'react';
import {
  SimulationRequest,
  Warehouse,
  Store,
  ProductItem,
  ScenarioSummary,
  TruckInstance,
  DispatchItinerary,
} from '../types/simulation';
import { LocationPickerMap } from '../components/LocationPickerMap';
import { ManageFleet } from './ManageFleet';
import { parseWarehousesCSV, parseStoresCSV } from '../services/csvParser';
import {
  Building2,
  Store as StoreIcon,
  Package,
  Truck,
  Database,
  Anchor,
  Plane,
  Upload,
  RotateCcw,
  Plus,
  Save,
} from 'lucide-react';

interface OrganizationPageProps {
  scenario: SimulationRequest;
  scenariosList: ScenarioSummary[];
  fleet: TruckInstance[];
  itineraries?: DispatchItinerary[];
  onSelectScenario: (scenarioId: string) => Promise<void>;
  onResetScenario: (scenarioId: string) => Promise<void>;
  onSaveScenario: (updated: SimulationRequest) => Promise<void>;
  onAddTruck: (truck: TruckInstance) => void;
  onDeleteTruck: (truckId: string) => void;
  onCustomScenarioLoaded?: (custom: SimulationRequest) => void;
  loading?: boolean;
}

type SubTab = 'scenarios' | 'warehouses' | 'stores' | 'products' | 'fleet';

export const OrganizationPage: React.FC<OrganizationPageProps> = ({
  scenario,
  scenariosList,
  fleet,
  itineraries = [],
  onSelectScenario,
  onResetScenario,
  onSaveScenario,
  onAddTruck,
  onDeleteTruck,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('scenarios');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // CSV file inputs
  const warehouseFileRef = useRef<HTMLInputElement>(null);
  const storeFileRef = useRef<HTMLInputElement>(null);

  // Economic Parameters Form State
  const currentEcon = scenario.fleet?.economic_parameters;
  const [scenarioName, setScenarioName] = useState(scenario.scenario_name);
  const [budgetCap, setBudgetCap] = useState(scenario.budget_cap_myr ?? 7000);
  const [fuelPrice, setFuelPrice] = useState(currentEcon?.fuel_price_myr_per_liter ?? 2.15);
  const [seaBaseFee, setSeaBaseFee] = useState(currentEcon?.intermodal_sea_base_fee_myr ?? 450);
  const [airBaseFee, setAirBaseFee] = useState(currentEcon?.intermodal_air_base_fee_myr ?? 1200);

  // Warehouse Modal State
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<number | null>(null);
  const [whName, setWhName] = useState('');
  const [whLat, setWhLat] = useState(3.139);
  const [whLng, setWhLng] = useState(101.6869);
  const [whIsPort, setWhIsPort] = useState(false);
  const [whIsAirport, setWhIsAirport] = useState(false);
  const [whInventory, setWhInventory] = useState<Record<string, number>>({});

  // Store Modal State
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
  const [stName, setStName] = useState('');
  const [stLat, setStLat] = useState(3.0738);
  const [stLng, setStLng] = useState(101.5183);
  const [stRequests, setStRequests] = useState<Record<string, number>>({});

  // Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [pId, setPId] = useState('');
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pCategory, setPCategory] = useState('General Goods');
  const [pWeight, setPWeight] = useState(10.0);
  const [pThreshold, setPThreshold] = useState(15);

  // New Custom Scenario Name
  const [newScenarioName, setNewScenarioName] = useState('');

  // Default product list if not yet defined
  const productsList: ProductItem[] = scenario.products && scenario.products.length > 0
    ? scenario.products
    : [
        { product_id: '0', name: 'Premium Paper Cartons (A4)', sku: 'P0-PAPER-A4', category: 'Office Supplies', unit_weight_kg: 15.0, low_stock_threshold: 20 },
        { product_id: '1', name: 'Commercial Ink Cartridges', sku: 'P1-INK-CART', category: 'Office Supplies', unit_weight_kg: 2.5, low_stock_threshold: 15 },
        { product_id: '2', name: 'Archive Filing Cabinets', sku: 'P2-ARCH-CAB', category: 'Storage & Hardware', unit_weight_kg: 35.0, low_stock_threshold: 10 },
      ];

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // -------------------------------------------------------------
  // Scenario Config Handlers
  // -------------------------------------------------------------
  const handleSaveScenarioMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: SimulationRequest = {
      ...scenario,
      scenario_name: scenarioName.trim() || scenario.scenario_name,
      budget_cap_myr: Number(budgetCap),
      fleet: {
        truck_models: scenario.fleet?.truck_models ?? [],
        economic_parameters: {
          fuel_price_myr_per_liter: Number(fuelPrice),
          intermodal_sea_base_fee_myr: Number(seaBaseFee),
          intermodal_sea_per_kg_myr: currentEcon?.intermodal_sea_per_kg_myr ?? 0.85,
          intermodal_air_base_fee_myr: Number(airBaseFee),
          intermodal_air_per_kg_myr: currentEcon?.intermodal_air_per_kg_myr ?? 4.50,
          default_budget_cap_myr: Number(budgetCap),
        },
      },
      is_modified: true,
    };
    await onSaveScenario(updated);
    showStatus('[OK] Scenario parameters saved and applied.');
  };

  const handleCreateCustomScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;
    const customId = `custom-${Date.now().toString().slice(-6)}`;
    const cloned: SimulationRequest = {
      ...scenario,
      scenario_id: customId,
      scenario_name: newScenarioName.trim(),
      is_preset: false,
      is_modified: false,
    };
    await onSaveScenario(cloned);
    setNewScenarioName('');
    showStatus(`[OK] Created new scenario '${cloned.scenario_name}'.`);
  };

  // CSV Handlers
  const handleWarehouseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsedWarehouses = parseWarehousesCSV(text);
        const updated: SimulationRequest = {
          ...scenario,
          scenario_name: `${scenario.scenario_name} (Custom Warehouses)`,
          warehouses: parsedWarehouses,
          is_modified: true,
        };
        await onSaveScenario(updated);
        showStatus(`[OK] Successfully ingested ${parsedWarehouses.length} warehouses from CSV.`);
      } catch (err: any) {
        showStatus(`[FAIL] ${err?.message || 'Failed to parse Warehouse CSV'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleStoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsedStores = parseStoresCSV(text);
        const updated: SimulationRequest = {
          ...scenario,
          scenario_name: `${scenario.scenario_name} (Custom Stores)`,
          stores: parsedStores,
          is_modified: true,
        };
        await onSaveScenario(updated);
        showStatus(`[OK] Successfully ingested ${parsedStores.length} stores from CSV.`);
      } catch (err: any) {
        showStatus(`[FAIL] ${err?.message || 'Failed to parse Store CSV'}`);
      }
    };
    reader.readAsText(file);
  };

  // -------------------------------------------------------------
  // Warehouse CRUD Handlers
  // -------------------------------------------------------------
  const handleOpenAddWarehouse = () => {
    setEditingWarehouseId(null);
    setWhName('');
    setWhLat(3.139);
    setWhLng(101.6869);
    setWhIsPort(false);
    setWhIsAirport(false);
    const initialInv: Record<string, number> = {};
    for (const p of productsList) {
      initialInv[p.product_id] = 0;
    }
    setWhInventory(initialInv);
    setWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (w: Warehouse) => {
    setEditingWarehouseId(w.warehouse_id);
    setWhName(w.name);
    setWhLat(w.latitude);
    setWhLng(w.longitude);
    setWhIsPort(w.is_port);
    setWhIsAirport(!!w.is_airport);
    setWhInventory({ ...w.inventory });
    setWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim()) return;

    let updatedWarehouses: Warehouse[];
    if (editingWarehouseId !== null) {
      // Editing existing
      updatedWarehouses = scenario.warehouses.map((w) =>
        w.warehouse_id === editingWarehouseId
          ? {
              ...w,
              name: whName.trim(),
              latitude: Number(whLat),
              longitude: Number(whLng),
              is_port: whIsPort,
              is_airport: whIsAirport,
              inventory: whInventory,
            }
          : w
      );
    } else {
      // Adding new
      const nextId =
        scenario.warehouses.length > 0
          ? Math.max(...scenario.warehouses.map((w) => w.warehouse_id)) + 1
          : 0;
      const newWh: Warehouse = {
        warehouse_id: nextId,
        name: whName.trim(),
        latitude: Number(whLat),
        longitude: Number(whLng),
        is_port: whIsPort,
        is_airport: whIsAirport,
        inventory: whInventory,
      };
      updatedWarehouses = [...scenario.warehouses, newWh];
    }

    const updated: SimulationRequest = {
      ...scenario,
      warehouses: updatedWarehouses,
      is_modified: true,
    };

    await onSaveScenario(updated);
    setWarehouseModalOpen(false);
    showStatus(`[OK] Warehouse '${whName.trim()}' saved.`);
  };

  const handleDeleteWarehouse = async (warehouseId: number) => {
    if (scenario.warehouses.length <= 1) {
      showStatus('[FAIL] At least one warehouse is required in the supply chain.');
      return;
    }
    const updatedWarehouses = scenario.warehouses.filter(
      (w) => w.warehouse_id !== warehouseId
    );
    const updated: SimulationRequest = {
      ...scenario,
      warehouses: updatedWarehouses,
      is_modified: true,
    };
    await onSaveScenario(updated);
    showStatus(`[OK] Warehouse ${warehouseId} deleted.`);
  };

  // -------------------------------------------------------------
  // Store CRUD Handlers
  // -------------------------------------------------------------
  const handleOpenAddStore = () => {
    setEditingStoreId(null);
    setStName('');
    setStLat(3.0738);
    setStLng(101.5183);
    const initialReq: Record<string, number> = {};
    for (const p of productsList) {
      initialReq[p.product_id] = 0;
    }
    setStRequests(initialReq);
    setStoreModalOpen(true);
  };

  const handleOpenEditStore = (s: Store) => {
    setEditingStoreId(s.store_id);
    setStName(s.name);
    setStLat(s.latitude);
    setStLng(s.longitude);
    setStRequests({ ...s.requests });
    setStoreModalOpen(true);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stName.trim()) return;

    let updatedStores: Store[];
    if (editingStoreId !== null) {
      updatedStores = scenario.stores.map((s) =>
        s.store_id === editingStoreId
          ? {
              ...s,
              name: stName.trim(),
              latitude: Number(stLat),
              longitude: Number(stLng),
              requests: stRequests,
            }
          : s
      );
    } else {
      const nextId =
        scenario.stores.length > 0
          ? Math.max(...scenario.stores.map((s) => s.store_id)) + 1
          : 0;
      const newStore: Store = {
        store_id: nextId,
        name: stName.trim(),
        latitude: Number(stLat),
        longitude: Number(stLng),
        requests: stRequests,
      };
      updatedStores = [...scenario.stores, newStore];
    }

    const updated: SimulationRequest = {
      ...scenario,
      stores: updatedStores,
      is_modified: true,
    };

    await onSaveScenario(updated);
    setStoreModalOpen(false);
    showStatus(`[OK] Store '${stName.trim()}' saved.`);
  };

  const handleDeleteStore = async (storeId: number) => {
    if (scenario.stores.length <= 1) {
      showStatus('[FAIL] At least one store is required in the scenario.');
      return;
    }
    const updatedStores = scenario.stores.filter((s) => s.store_id !== storeId);
    const updated: SimulationRequest = {
      ...scenario,
      stores: updatedStores,
      is_modified: true,
    };
    await onSaveScenario(updated);
    showStatus(`[OK] Store ${storeId} deleted.`);
  };

  // -------------------------------------------------------------
  // Product CRUD Handlers
  // -------------------------------------------------------------
  const handleOpenAddProduct = () => {
    setEditingProductId(null);
    const nextNumeric = productsList.length;
    setPId(String(nextNumeric));
    setPName('');
    setPSku(`P${nextNumeric}-ITEM`);
    setPCategory('General Merchandise');
    setPWeight(10.0);
    setPThreshold(15);
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: ProductItem) => {
    setEditingProductId(p.product_id);
    setPId(p.product_id);
    setPName(p.name);
    setPSku(p.sku);
    setPCategory(p.category || 'General Merchandise');
    setPWeight(p.unit_weight_kg);
    setPThreshold(p.low_stock_threshold);
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || !pId.trim()) return;

    let updatedProducts: ProductItem[];
    if (editingProductId !== null) {
      updatedProducts = productsList.map((p) =>
        p.product_id === editingProductId
          ? {
              ...p,
              name: pName.trim(),
              sku: pSku.trim(),
              category: pCategory.trim(),
              unit_weight_kg: Number(pWeight),
              low_stock_threshold: Number(pThreshold),
            }
          : p
      );
    } else {
      const newProd: ProductItem = {
        product_id: pId.trim(),
        name: pName.trim(),
        sku: pSku.trim(),
        category: pCategory.trim(),
        unit_weight_kg: Number(pWeight),
        low_stock_threshold: Number(pThreshold),
      };
      updatedProducts = [...productsList, newProd];
    }

    const updated: SimulationRequest = {
      ...scenario,
      products: updatedProducts,
      is_modified: true,
    };

    await onSaveScenario(updated);
    setProductModalOpen(false);
    showStatus(`[OK] Product '${pName.trim()}' saved to catalog.`);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (productsList.length <= 1) {
      showStatus('[FAIL] At least one product must exist in catalog.');
      return;
    }
    const updatedProducts = productsList.filter((p) => p.product_id !== productId);
    const updated: SimulationRequest = {
      ...scenario,
      products: updatedProducts,
      is_modified: true,
    };
    await onSaveScenario(updated);
    showStatus(`[OK] Product ${productId} removed.`);
  };

  return (
    <div className="space-y-6 font-mono text-white">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider">
            Organization & Master Supply Chain Data Console
          </h2>
          <p className="text-xs text-neutral-400">
            Multi-modal logistics nodes, product specifications, inventory baselines, and fleet assets
          </p>
        </div>

        {/* Status Notification Toast */}
        {statusMessage && (
          <div className="px-3 py-1.5 bg-neutral-900 border border-neutral-600 text-white text-xs font-bold animate-fadeIn">
            {statusMessage}
          </div>
        )}
      </div>

      {/* 2. Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-800 pb-2">
        <button
          onClick={() => setActiveSubTab('scenarios')}
          className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center space-x-2 ${
            activeSubTab === 'scenarios'
              ? 'bg-white text-black'
              : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>DATA SOURCE & SCENARIOS</span>
        </button>

        <button
          onClick={() => setActiveSubTab('warehouses')}
          className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center space-x-2 ${
            activeSubTab === 'warehouses'
              ? 'bg-white text-black'
              : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>WAREHOUSES ({scenario.warehouses.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('stores')}
          className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center space-x-2 ${
            activeSubTab === 'stores'
              ? 'bg-white text-black'
              : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
          }`}
        >
          <StoreIcon className="w-3.5 h-3.5" />
          <span>STORES ({scenario.stores.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('products')}
          className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center space-x-2 ${
            activeSubTab === 'products'
              ? 'bg-white text-black'
              : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>PRODUCTS ({productsList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('fleet')}
          className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer flex items-center space-x-2 ${
            activeSubTab === 'fleet'
              ? 'bg-white text-black'
              : 'bg-black text-white hover:bg-neutral-900 border border-neutral-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>FLEET ASSETS ({fleet.length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 1: DATA SOURCE & SCENARIOS */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'scenarios' && (
        <div className="space-y-6">
          {/* Active Scenario Overview Ribbon */}
          <div className="bg-neutral-950 p-4 border border-neutral-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest">
                    Active Scenario:
                  </span>
                  {scenario.is_modified ? (
                    <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                      [MODIFIED FROM BASELINE]
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-neutral-900 text-neutral-300 border border-neutral-700 text-[10px] font-bold">
                      [FACTORY BASELINE]
                    </span>
                  )}
                  {scenario.is_preset && (
                    <span className="px-2 py-0.5 bg-neutral-900 text-cyan-400 border border-cyan-800 text-[10px] font-bold">
                      [BUILT-IN PRESET]
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  {scenario.scenario_name}
                </h3>
              </div>

              {/* Reset to Factory Button */}
              {scenario.is_preset && scenario.is_modified && (
                <button
                  type="button"
                  onClick={() => onResetScenario(scenario.scenario_id || 'bob-stationery')}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-white hover:text-black border border-neutral-600 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>[RESET TO FACTORY BASELINE]</span>
                </button>
              )}
            </div>
          </div>

          {/* Preset Scenarios Switcher Grid */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-neutral-400 font-bold">
              Available Preset Scenarios (SQLite Persistent):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {scenariosList.map((sc) => {
                const isCurrentlyActive =
                  scenario.scenario_id === sc.scenario_id ||
                  (!scenario.scenario_id && sc.scenario_id === 'bob-stationery');

                return (
                  <div
                    key={sc.scenario_id}
                    className={`p-4 border transition-all flex flex-col justify-between ${
                      isCurrentlyActive
                        ? 'bg-neutral-950 border-white'
                        : 'bg-black border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400 font-bold uppercase">
                          {sc.is_preset ? '[PRESET]' : '[CUSTOM]'}
                        </span>
                        {sc.is_modified && (
                          <span className="text-[9px] text-amber-400 font-bold">
                            [MODIFIED]
                          </span>
                        )}
                        {isCurrentlyActive && (
                          <span className="text-[10px] bg-white text-black px-1.5 py-0.5 font-bold">
                            [ACTIVE]
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-white">
                        {sc.scenario_name}
                      </div>
                      <div className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-900">
                        {sc.warehouse_count} Warehouses | {sc.store_count} Stores | Cap: MYR {sc.budget_cap_myr.toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-900 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectScenario(sc.scenario_id)}
                        disabled={isCurrentlyActive}
                        className={`flex-1 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                          isCurrentlyActive
                            ? 'bg-neutral-900 text-neutral-500 cursor-not-allowed'
                            : 'bg-white text-black hover:bg-neutral-200'
                        }`}
                      >
                        {isCurrentlyActive ? 'Current' : 'Activate'}
                      </button>

                      {sc.is_preset && sc.is_modified && (
                        <button
                          type="button"
                          onClick={() => onResetScenario(sc.scenario_id)}
                          className="px-2 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-[10px] text-neutral-300"
                          title="Reset to factory baseline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Economic Parameters & Budget Settings Form */}
          <form
            onSubmit={handleSaveScenarioMetadata}
            className="bg-neutral-950 p-5 border border-neutral-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Scenario Settings & Economic Cost Rates
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Update budget ceiling and multi-modal transport cost tariffs
                </p>
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>SAVE CONFIG</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Scenario Title
                </label>
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Total Budget Cap (MYR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={budgetCap}
                  onChange={(e) => setBudgetCap(Number(e.target.value))}
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Diesel Fuel Price (MYR / Liter)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.05"
                  value={fuelPrice}
                  onChange={(e) => setFuelPrice(Number(e.target.value))}
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Maritime Sea Intermodal Base Fee (MYR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={seaBaseFee}
                  onChange={(e) => setSeaBaseFee(Number(e.target.value))}
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Air Cargo Intermodal Base Fee (MYR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={airBaseFee}
                  onChange={(e) => setAirBaseFee(Number(e.target.value))}
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>
            </div>
          </form>

          {/* Ingestion & Cloner Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CSV Ingestion Box */}
            <div className="bg-neutral-950 p-4 border border-neutral-800 space-y-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4 text-white" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Bulk CSV Master Data Ingestion
                </h4>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Upload CSV files to replace active facilities. The format requires headers:
                <code className="text-neutral-300 block mt-1 text-[10px] bg-black p-1 border border-neutral-900">
                  warehouse_id,name,latitude,longitude,is_port,is_airport,product_id,quantity
                </code>
                <code className="text-neutral-300 block mt-1 text-[10px] bg-black p-1 border border-neutral-900">
                  store_id,name,latitude,longitude,product_id,requested_qty
                </code>
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <input
                  type="file"
                  ref={warehouseFileRef}
                  onChange={handleWarehouseUpload}
                  accept=".csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => warehouseFileRef.current?.click()}
                  className="px-3 py-1.5 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white text-xs font-bold cursor-pointer transition-colors"
                >
                  [UPLOAD WAREHOUSES CSV]
                </button>

                <input
                  type="file"
                  ref={storeFileRef}
                  onChange={handleStoreUpload}
                  accept=".csv"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => storeFileRef.current?.click()}
                  className="px-3 py-1.5 bg-black hover:bg-neutral-900 border border-neutral-700 hover:border-white text-xs font-bold cursor-pointer transition-colors"
                >
                  [UPLOAD STORES CSV]
                </button>
              </div>
            </div>

            {/* Clone / New Scenario Form */}
            <div className="bg-neutral-950 p-4 border border-neutral-800 space-y-3">
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-white" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Clone to New Custom Scenario
                </h4>
              </div>
              <p className="text-[11px] text-neutral-400">
                Create an independent copy of current supply chain parameters into SQLite
              </p>
              <form onSubmit={handleCreateCustomScenario} className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="e.g. Q4 Peak Surge Scenario"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newScenarioName.trim()}
                  className="w-full py-1.5 bg-white disabled:bg-neutral-900 text-black disabled:text-neutral-500 text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  [CREATE INDEPENDENT SCENARIO]
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 2: WAREHOUSES */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold">
                Warehouse Facilities Directory
              </div>
              <div className="text-[11px] text-neutral-400">
                {scenario.warehouses.length} Active Nodes | Total Stock:{' '}
                {scenario.warehouses.reduce(
                  (acc, w) => acc + Object.values(w.inventory).reduce((a, b) => a + b, 0),
                  0
                )}{' '}
                units
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenAddWarehouse}
              className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ADD WAREHOUSE</span>
            </button>
          </div>

          {/* Warehouses Table */}
          <div className="border border-neutral-800 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 text-[10px] uppercase">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Facility Name</th>
                  <th className="p-3">Coordinates (Lat, Lng)</th>
                  <th className="p-3">Landmass</th>
                  <th className="p-3">Modality</th>
                  <th className="p-3">Total Stock</th>
                  <th className="p-3">Product Inventory</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 bg-black">
                {scenario.warehouses.map((w) => {
                  const isEast = w.longitude >= 105.0;
                  const totalUnits = Object.values(w.inventory).reduce((a, b) => a + b, 0);

                  return (
                    <tr key={w.warehouse_id} className="hover:bg-neutral-950 transition-colors">
                      <td className="p-3 font-bold text-neutral-400">W{w.warehouse_id}</td>
                      <td className="p-3 font-bold text-white">{w.name}</td>
                      <td className="p-3 text-neutral-300">
                        {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold ${
                            isEast
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isEast ? '[EAST MALAYSIA]' : '[PENINSULAR]'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-1">
                          {w.is_airport && (
                            <span className="px-1.5 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold flex items-center space-x-1">
                              <Plane className="w-3 h-3" />
                              <span>[AIR HUB]</span>
                            </span>
                          )}
                          {w.is_port && (
                            <span className="px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold flex items-center space-x-1">
                              <Anchor className="w-3 h-3" />
                              <span>[PORT DEPOT]</span>
                            </span>
                          )}
                          {!w.is_airport && !w.is_port && (
                            <span className="px-1.5 py-0.5 bg-neutral-900 text-neutral-400 border border-neutral-700 text-[10px] font-bold">
                              [LAND DEPOT]
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-white">{totalUnits} units</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(w.inventory).map(([pid, qty]) => (
                            <span
                              key={pid}
                              className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300"
                            >
                              P{pid}: <strong className="text-white">{qty}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditWarehouse(w)}
                            className="px-2 py-1 bg-neutral-900 hover:bg-white hover:text-black text-neutral-300 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            [EDIT]
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWarehouse(w.warehouse_id)}
                            className="px-2 py-1 bg-neutral-950 hover:bg-red-950 hover:text-red-300 border border-neutral-800 text-neutral-500 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            [DEL]
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 3: STORES */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'stores' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold">
                Retail Store Demand Points
              </div>
              <div className="text-[11px] text-neutral-400">
                {scenario.stores.length} Retail Outlets | Total Requested:{' '}
                {scenario.stores.reduce(
                  (acc, s) => acc + Object.values(s.requests).reduce((a, b) => a + b, 0),
                  0
                )}{' '}
                units
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenAddStore}
              className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ADD STORE</span>
            </button>
          </div>

          {/* Stores Table */}
          <div className="border border-neutral-800 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 text-[10px] uppercase">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Store Outlet Name</th>
                  <th className="p-3">Coordinates (Lat, Lng)</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Total Requested</th>
                  <th className="p-3">SKU Requests</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 bg-black">
                {scenario.stores.map((s) => {
                  const isEast = s.longitude >= 105.0;
                  const totalReq = Object.values(s.requests).reduce((a, b) => a + b, 0);

                  return (
                    <tr key={s.store_id} className="hover:bg-neutral-950 transition-colors">
                      <td className="p-3 font-bold text-neutral-400">S{s.store_id}</td>
                      <td className="p-3 font-bold text-white">{s.name}</td>
                      <td className="p-3 text-neutral-300">
                        {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold ${
                            isEast
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isEast ? '[EAST MALAYSIA]' : '[PENINSULAR]'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-white">{totalReq} units</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(s.requests).map(([pid, qty]) => (
                            <span
                              key={pid}
                              className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300"
                            >
                              P{pid}: <strong className="text-white">{qty}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStore(s)}
                            className="px-2 py-1 bg-neutral-900 hover:bg-white hover:text-black text-neutral-300 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            [EDIT]
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStore(s.store_id)}
                            className="px-2 py-1 bg-neutral-950 hover:bg-red-950 hover:text-red-300 border border-neutral-800 text-neutral-500 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            [DEL]
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 4: PRODUCTS */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold">
                Product SKU Master Catalog
              </div>
              <div className="text-[11px] text-neutral-400">
                {productsList.length} Registered Commodities | Low-stock alert thresholds & physical unit weights
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenAddProduct}
              className="px-3 py-1.5 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ ADD PRODUCT</span>
            </button>
          </div>

          {/* Products Table */}
          <div className="border border-neutral-800 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 text-[10px] uppercase">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU Code</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Unit Weight (kg)</th>
                  <th className="p-3">Low-Stock Alert Threshold</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 bg-black">
                {productsList.map((p) => (
                  <tr key={p.product_id} className="hover:bg-neutral-950 transition-colors">
                    <td className="p-3 font-bold text-neutral-400">P{p.product_id}</td>
                    <td className="p-3 font-bold text-white">{p.name}</td>
                    <td className="p-3 text-neutral-300 font-bold">{p.sku}</td>
                    <td className="p-3 text-neutral-400">{p.category ?? 'General'}</td>
                    <td className="p-3 text-white font-bold">{p.unit_weight_kg} kg</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                        &lt; {p.low_stock_threshold} units
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditProduct(p)}
                          className="px-2 py-1 bg-neutral-900 hover:bg-white hover:text-black text-neutral-300 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          [EDIT]
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.product_id)}
                          className="px-2 py-1 bg-neutral-950 hover:bg-red-950 hover:text-red-300 border border-neutral-800 text-neutral-500 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          [DEL]
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 5: FLEET */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'fleet' && (
        <ManageFleet
          fleet={fleet}
          itineraries={itineraries}
          warehouses={scenario.warehouses}
          onAddTruck={onAddTruck}
          onDeleteTruck={onDeleteTruck}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT WAREHOUSE */}
      {/* ------------------------------------------------------------- */}
      {warehouseModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-950 border border-neutral-800 max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {editingWarehouseId !== null ? `Edit Warehouse W${editingWarehouseId}` : 'Add New Warehouse'}
              </h3>
              <button
                type="button"
                onClick={() => setWarehouseModalOpen(false)}
                className="text-neutral-500 hover:text-white text-xs font-bold"
              >
                [X CLOSE]
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-4">
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Warehouse Facility Name
                </label>
                <input
                  type="text"
                  required
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="e.g. Butterworth Logistics Depot"
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              {/* Location Picker Map */}
              <LocationPickerMap
                latitude={whLat}
                longitude={whLng}
                onChangeLocation={(lat, lng) => {
                  setWhLat(lat);
                  setWhLng(lng);
                }}
                existingWarehouses={scenario.warehouses.filter(
                  (w) => w.warehouse_id !== editingWarehouseId
                )}
                existingStores={scenario.stores}
                label={whName || 'Warehouse'}
              />

              {/* Modality Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center space-x-2 bg-black p-3 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whIsPort}
                    onChange={(e) => setWhIsPort(e.target.checked)}
                    className="accent-white"
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Sea Port Harbor Channel</span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Enables inter-island maritime container fairway connection
                    </div>
                  </div>
                </label>

                <label className="flex items-center space-x-2 bg-black p-3 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whIsAirport}
                    onChange={(e) => setWhIsAirport(e.target.checked)}
                    className="accent-white"
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Plane className="w-3.5 h-3.5 text-purple-400" />
                      <span>Air Cargo Flight Hub</span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Enables expedited flight corridor transshipment
                    </div>
                  </div>
                </label>
              </div>

              {/* Stock Inventory by Product */}
              <div className="space-y-2 pt-2 border-t border-neutral-900">
                <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-300">
                  Initial Stock Inventory By Product SKU:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {productsList.map((p) => (
                    <div key={p.product_id} className="bg-black p-2 border border-neutral-800">
                      <label className="block text-[10px] text-neutral-400 uppercase tracking-tight">
                        P{p.product_id}: {p.name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={whInventory[p.product_id] ?? 0}
                        onChange={(e) =>
                          setWhInventory({
                            ...whInventory,
                            [p.product_id]: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="mt-1 w-full bg-neutral-950 border border-neutral-700 text-white text-xs px-2 py-1 font-mono focus:border-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setWarehouseModalOpen(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT STORE */}
      {/* ------------------------------------------------------------- */}
      {storeModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-950 border border-neutral-800 max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {editingStoreId !== null ? `Edit Store S${editingStoreId}` : 'Add New Retail Store'}
              </h3>
              <button
                type="button"
                onClick={() => setStoreModalOpen(false)}
                className="text-neutral-500 hover:text-white text-xs font-bold"
              >
                [X CLOSE]
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-4">
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Retail Store Name
                </label>
                <input
                  type="text"
                  required
                  value={stName}
                  onChange={(e) => setStName(e.target.value)}
                  placeholder="e.g. Johor Bahru Central Supermarket"
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              {/* Location Picker Map */}
              <LocationPickerMap
                latitude={stLat}
                longitude={stLng}
                onChangeLocation={(lat, lng) => {
                  setStLat(lat);
                  setStLng(lng);
                }}
                existingWarehouses={scenario.warehouses}
                existingStores={scenario.stores.filter(
                  (s) => s.store_id !== editingStoreId
                )}
                label={stName || 'Store Outlet'}
              />

              {/* Requests Demand by Product */}
              <div className="space-y-2 pt-2 border-t border-neutral-900">
                <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-300">
                  Requested Demand Quantity By SKU:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {productsList.map((p) => (
                    <div key={p.product_id} className="bg-black p-2 border border-neutral-800">
                      <label className="block text-[10px] text-neutral-400 uppercase tracking-tight">
                        P{p.product_id}: {p.name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={stRequests[p.product_id] ?? 0}
                        onChange={(e) =>
                          setStRequests({
                            ...stRequests,
                            [p.product_id]: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="mt-1 w-full bg-neutral-950 border border-neutral-700 text-white text-xs px-2 py-1 font-mono focus:border-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStoreModalOpen(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Save Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT PRODUCT */}
      {/* ------------------------------------------------------------- */}
      {productModalOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {editingProductId !== null ? `Edit Product P${editingProductId}` : 'Add New Product SKU'}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="text-neutral-500 hover:text-white text-xs font-bold"
              >
                [X CLOSE]
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                    Product ID
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingProductId !== null}
                    value={pId}
                    onChange={(e) => setPId(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full bg-black border border-neutral-800 disabled:bg-neutral-900 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    required
                    value={pSku}
                    onChange={(e) => setPSku(e.target.value)}
                    placeholder="e.g. P3-IND-CBL"
                    className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="e.g. Industrial Network Cabling Reel"
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={pCategory}
                  onChange={(e) => setPCategory(e.target.value)}
                  placeholder="e.g. Hardware / Electronics"
                  className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                    Unit Weight (kg)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={pWeight}
                    onChange={(e) => setPWeight(Number(e.target.value))}
                    className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
                    Low-Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={pThreshold}
                    onChange={(e) => setPThreshold(Number(e.target.value))}
                    className="w-full bg-black border border-neutral-800 text-white text-xs px-3 py-2 font-mono focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
