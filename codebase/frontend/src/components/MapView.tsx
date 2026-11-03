import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Warehouse, Store } from '../types/simulation';
import { Building2, Store as StoreIcon, Anchor } from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface MapViewProps {
  warehouses: Warehouse[];
  stores: Store[];
}

// Custom monochrome high-contrast DivIcons
const createWarehouseIcon = (isPort: boolean) => {
  const iconHtml = renderToString(
    <div className={`flex items-center justify-center w-8 h-8 rounded-full shadow-2xl transition-transform hover:scale-110 ${
      isPort
        ? 'bg-white text-black border-2 border-white ring-2 ring-neutral-700'
        : 'bg-white text-black border-2 border-neutral-300'
    }`}>
      {isPort ? <Anchor className="w-4 h-4 stroke-[2.5]" /> : <Building2 className="w-4 h-4 stroke-[2.5]" />}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-warehouse-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const createStoreIcon = () => {
  const iconHtml = renderToString(
    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-neutral-900 border-2 border-white text-white shadow-2xl transition-transform hover:scale-110">
      <StoreIcon className="w-4 h-4 stroke-[2]" />
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-store-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export const MapView: React.FC<MapViewProps> = ({ warehouses, stores }) => {
  // Center between Peninsular and Borneo
  const defaultCenter: [number, number] = [3.8, 108.5];
  const defaultZoom = 6;

  return (
    <div className="relative w-full h-[560px] rounded-lg overflow-hidden border border-neutral-800 shadow-2xl bg-black">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="w-full h-full bg-black"
      >
        {/* Standard OpenStreetMap tiles with CSS dark monochrome inversion (zero API key required) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Warehouse Nodes */}
        {warehouses.map((w) => (
          <Marker
            key={`wh-${w.warehouse_id}`}
            position={[w.latitude, w.longitude]}
            icon={createWarehouseIcon(w.is_port)}
          >
            <Popup>
              <div className="p-1 min-w-[200px] font-mono text-white">
                <div className="flex items-center justify-between border-b border-neutral-700 pb-1.5 mb-2">
                  <span className="font-bold text-xs tracking-wide">{w.name}</span>
                  {w.is_port ? (
                    <span className="text-[10px] px-1 py-0.5 bg-white text-black font-bold rounded">
                      [PORT HUB]
                    </span>
                  ) : (
                    <span className="text-[10px] px-1 py-0.5 bg-neutral-800 text-neutral-300 rounded border border-neutral-700">
                      [WH]
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-400 mb-2">
                  ID: W{w.warehouse_id} | {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1 border-t border-neutral-800 pt-1">
                  Available Stock:
                </div>
                <div className="space-y-1">
                  {Object.entries(w.inventory).length > 0 ? (
                    Object.entries(w.inventory).map(([pid, qty]) => (
                      <div key={pid} className="flex justify-between text-xs">
                        <span className="text-neutral-300">Product P{pid}</span>
                        <span className="text-white font-bold">{qty} units</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-neutral-500 text-xs italic">Zero stock</span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Store Demand Nodes */}
        {stores.map((s) => (
          <Marker
            key={`store-${s.store_id}`}
            position={[s.latitude, s.longitude]}
            icon={createStoreIcon()}
          >
            <Popup>
              <div className="p-1 min-w-[200px] font-mono text-white">
                <div className="flex items-center justify-between border-b border-neutral-700 pb-1.5 mb-2">
                  <span className="font-bold text-xs tracking-wide">{s.name}</span>
                  <span className="text-[10px] px-1 py-0.5 bg-neutral-800 text-neutral-200 border border-neutral-600 rounded font-bold">
                    [STORE]
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 mb-2">
                  ID: S{s.store_id} | {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1 border-t border-neutral-800 pt-1">
                  Demand Request:
                </div>
                <div className="space-y-1">
                  {Object.entries(s.requests).length > 0 ? (
                    Object.entries(s.requests).map(([pid, qty]) => (
                      <div key={pid} className="flex justify-between text-xs">
                        <span className="text-neutral-300">Product P{pid}</span>
                        <span className="text-white font-bold">{qty} units</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-neutral-500 text-xs italic">No request</span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating High-Contrast Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-black/95 backdrop-blur border border-neutral-800 p-3 rounded shadow-2xl text-xs font-mono space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800 pb-1 font-semibold">
          Node Classification
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-white border border-neutral-400" />
          <span className="text-white">Warehouse (Supply)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-white ring-2 ring-neutral-700" />
          <span className="text-white">Port Gateway (Intermodal)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-sm bg-neutral-900 border border-white" />
          <span className="text-white">Store (Demand Node)</span>
        </div>
      </div>
    </div>
  );
};
