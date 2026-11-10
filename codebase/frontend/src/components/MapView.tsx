import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Warehouse, Store, NetworkEdge, DispatchItinerary, TruckInstance } from '../types/simulation';
import { Building2, Store as StoreIcon, Anchor, Plane } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { AnimatedTruckMarker } from './AnimatedTruckMarker';

interface MapViewProps {
  warehouses: Warehouse[];
  stores: Store[];
  edges?: NetworkEdge[];
  itineraries?: DispatchItinerary[];
  trucks?: TruckInstance[];
  highlightedPath?: [number, number][];
  highlightLabel?: string;
  panTarget?: [number, number] | null;
  onSelectStore?: (store: Store) => void;
  onSelectWarehouse?: (warehouse: Warehouse) => void;
}

// Controller component to pan / fly the Leaflet camera to selected coordinates
const MapPanController: React.FC<{ panTarget?: [number, number] | null }> = ({ panTarget }) => {
  const map = useMap();

  React.useEffect(() => {
    if (panTarget) {
      map.flyTo(panTarget, 13, {
        duration: 1.2,
      });
    }
  }, [panTarget, map]);

  return null;
};

// Custom monochrome high-contrast DivIcons
const createWarehouseIcon = (isPort: boolean, isAirport?: boolean) => {
  const ringClass = isAirport
    ? 'bg-white text-black border-2 border-white ring-2 ring-purple-400'
    : isPort
    ? 'bg-white text-black border-2 border-white ring-2 ring-cyan-400'
    : 'bg-white text-black border-2 border-neutral-300';

  const iconHtml = renderToString(
    <div className={`flex items-center justify-center w-8 h-8 rounded-full shadow-2xl transition-transform hover:scale-110 ${ringClass}`}>
      {isAirport ? (
        <Plane className="w-4 h-4 stroke-[2.5]" />
      ) : isPort ? (
        <Anchor className="w-4 h-4 stroke-[2.5]" />
      ) : (
        <Building2 className="w-4 h-4 stroke-[2.5]" />
      )}
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

export const MapView: React.FC<MapViewProps> = ({
  warehouses,
  stores,
  edges = [],
  itineraries = [],
  trucks = [],
  highlightedPath,
  highlightLabel,
  panTarget,
  onSelectStore,
  onSelectWarehouse,
}) => {
  const defaultCenter: [number, number] = [3.8, 108.5];
  const defaultZoom = 6;

  // Map active itineraries by truck ID
  const itineraryByTruck = useMemo(() => {
    const map = new Map<string, DispatchItinerary>();
    for (const itin of itineraries) {
      map.set(itin.truck_id, itin);
    }
    return map;
  }, [itineraries]);

  // Compute displayed trucks (fallback to itinerary records if trucks list is empty)
  const displayedTrucks = useMemo(() => {
    if (trucks && trucks.length > 0) {
      return trucks;
    }
    if (itineraries && itineraries.length > 0) {
      return itineraries.map((itin) => ({
        truck_id: itin.truck_id,
        name: itin.truck_name,
        model_id: 'standard_lorry',
        image_url: itin.truck_image,
        payload_capacity_kg: 3500,
        fuel_economy_kmpl: 8.5,
        fuel_tank_capacity_l: 100,
        current_location_name: itin.source_warehouse_name,
        current_coords: (itin.legs[0]?.origin_coords || [3.139, 101.6869]) as [number, number],
        is_assigned: true,
      }));
    }
    return [];
  }, [trucks, itineraries]);

  // Group trucks sharing the same route corridor to calculate headway stagger & lateral offset
  const corridorGroupInfo = useMemo(() => {
    const groupMap = new Map<string, string[]>(); // corridorKey -> [truck_id, ...]

    for (const truck of displayedTrucks) {
      const itin = itineraryByTruck.get(truck.truck_id);
      if (itin) {
        const key = `${itin.source_warehouse_id}->${itin.target_store_id}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(truck.truck_id);
      }
    }

    const truckSpacingInfo = new Map<string, { coRoutedIndex: number; totalCoRouted: number }>();
    for (const [, truckIds] of groupMap.entries()) {
      truckIds.forEach((id, idx) => {
        truckSpacingInfo.set(id, { coRoutedIndex: idx, totalCoRouted: truckIds.length });
      });
    }

    return truckSpacingInfo;
  }, [displayedTrucks, itineraryByTruck]);

  return (
    <div className="relative w-full h-[580px] rounded-none overflow-hidden border border-neutral-800 bg-black">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        minZoom={3}
        maxZoom={18}
        scrollWheelZoom={true}
        className="w-full h-full bg-black"
      >
        {/* Dynamic camera pan / fly controller */}
        <MapPanController panTarget={panTarget} />

        {/* Standard OpenStreetMap tiles loaded smoothly with GPU caching without clipping bounds */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          keepBuffer={8}
        />

        {/* Hover-Highlighted Active Commodity Allocation Flow */}
        {highlightedPath && highlightedPath.length > 0 && (
          <Polyline
            positions={highlightedPath}
            pathOptions={{
              color: '#ffffff',
              weight: 5.0,
              opacity: 0.95,
              dashArray: '4, 4',
            }}
          >
            {highlightLabel && (
              <Popup>
                <div className="p-1 font-mono text-white text-xs font-bold">
                  {highlightLabel}
                </div>
              </Popup>
            )}
          </Polyline>
        )}

        {/* Network Graph Edges with Chromatic High-Contrast Palette */}
        {edges.map((edge, idx) => {
          const isMaritime = edge.modality === 1;
          const isAir = edge.modality === 2;

          // Color palette: Light Blue for Maritime, Amber for Land, Red for Infeasible
          const strokeColor = isMaritime ? '#38bdf8' : isAir ? '#c084fc' : '#f59e0b';
          const dashStyle = isMaritime ? '8, 8' : undefined;
          const weight = isMaritime ? 3.5 : 2.5;

          const polylineCoords: [number, number][] =
            edge.path_coordinates && edge.path_coordinates.length > 0
              ? edge.path_coordinates
              : [edge.source_coords, edge.target_coords];

          return (
            <Polyline
              key={`edge-${idx}-${edge.source_id}-${edge.target_id}`}
              positions={polylineCoords}
              pathOptions={{
                color: strokeColor,
                weight: weight,
                dashArray: dashStyle,
                opacity: 0.85,
              }}
            >
              <Popup>
                <div className="p-1 min-w-[210px] font-mono text-white text-xs space-y-1">
                  <div className="font-bold border-b border-neutral-700 pb-1 flex justify-between items-center">
                    <span>{isAir ? 'Air Freight Corridor' : isMaritime ? 'Maritime Sea Lane' : 'Highway Freight Road'}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{
                        backgroundColor: isAir ? '#3b0764' : isMaritime ? '#082f49' : '#451a03',
                        color: strokeColor,
                        border: `1px solid ${strokeColor}`,
                      }}
                    >
                      {isAir ? '[AIR]' : isMaritime ? '[SEA]' : '[LAND]'}
                    </span>
                  </div>
                  <div className="text-neutral-300 pt-1">
                    {edge.source_name} &harr; {edge.target_name}
                  </div>
                  <div className="flex justify-between text-neutral-400 text-[11px]">
                    <span>Distance:</span>
                    <span className="text-white font-bold">{edge.distance_km} km</span>
                  </div>
                  <div className="flex justify-between text-neutral-400 text-[11px]">
                    <span>Transit Time:</span>
                    <span className="text-white font-bold">~{edge.transit_hours} hrs</span>
                  </div>
                  {(isMaritime || isAir) && (
                    <div className="flex justify-between text-neutral-400 text-[11px] border-t border-neutral-800 pt-1">
                      <span>Carrier Base Fee:</span>
                      <span className={isAir ? 'text-purple-400 font-bold' : 'text-cyan-400 font-bold'}>
                        MYR {edge.base_fee_myr}
                      </span>
                    </div>
                  )}
                  {isAir && edge.cost_per_kg_myr > 0 && (
                    <div className="flex justify-between text-neutral-400 text-[11px]">
                      <span>Air Cargo Rate:</span>
                      <span className="text-purple-400 font-bold">MYR {edge.cost_per_kg_myr}/kg</span>
                    </div>
                  )}
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Warehouse Nodes */}
        {warehouses.map((w) => (
          <Marker
            key={`wh-${w.warehouse_id}`}
            position={[w.latitude, w.longitude]}
            icon={createWarehouseIcon(w.is_port, w.is_airport)}
            eventHandlers={{
              click: () => onSelectWarehouse?.(w),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[210px] font-mono text-white">
                <div className="flex items-center justify-between border-b border-neutral-700 pb-1.5 mb-1.5">
                  <span className="font-bold text-xs tracking-wide">{w.name}</span>
                  {w.is_airport ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-950 text-purple-300 border border-purple-700 font-bold rounded">
                      [AIR CARGO HUB]
                    </span>
                  ) : w.is_port ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold rounded">
                      [PORT DEPOT]
                    </span>
                  ) : (
                    <span className="text-[10px] px-1 py-0.5 bg-neutral-800 text-neutral-300 rounded border border-neutral-700">
                      [WAREHOUSE]
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-neutral-400 mb-1">
                  {w.is_airport
                    ? 'Airport cargo transshipment hub (expedited air cargo)'
                    : w.is_port
                    ? 'Port-adjacent bonded depot (sea transshipment)'
                    : 'Inland distribution warehouse'}
                </div>
                <div className="text-[11px] text-neutral-500 mb-2 font-mono">
                  ID: W{w.warehouse_id} | {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1 border-t border-neutral-800 pt-1">
                  {w.is_port ? 'Depot Inventory On-Site:' : 'Available Stock:'}
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
            eventHandlers={{
              click: () => onSelectStore?.(s),
            }}
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

        {/* Animated Commercial Fleet Trucks */}
        {displayedTrucks.map((truck, overallIdx) => {
          const spacing = corridorGroupInfo.get(truck.truck_id) || {
            coRoutedIndex: 0,
            totalCoRouted: 1,
          };
          return (
            <AnimatedTruckMarker
              key={`animated-truck-${truck.truck_id}`}
              truck={truck}
              truckIndex={overallIdx}
              coRoutedIndex={spacing.coRoutedIndex}
              totalCoRouted={spacing.totalCoRouted}
              itinerary={itineraryByTruck.get(truck.truck_id)}
            />
          );
        })}
      </MapContainer>

      {/* Floating Chromatic Map Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-black border border-neutral-800 p-3 rounded-none text-xs font-mono space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800 pb-1 font-semibold">
          Network Topology Legend
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-5 h-0.5 bg-amber-500" />
          <span className="text-neutral-300">Land Highway Edge</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-5 h-0.5 border-t-2 border-dashed border-cyan-400" />
          <span className="text-neutral-300">Maritime Sea Corridor</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-5 h-0.5 bg-purple-400" />
          <span className="text-neutral-300">Air Freight Corridor</span>
        </div>
        <div className="h-px bg-neutral-800 my-1" />
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-white border border-neutral-400" />
          <span className="text-white">Warehouse (Supply)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-white ring-2 ring-cyan-400" />
          <span className="text-white">Port Logistics Depot</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-full bg-white ring-2 ring-purple-400" />
          <span className="text-white">Air Cargo Hub</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3.5 h-3.5 rounded-sm bg-neutral-900 border border-white" />
          <span className="text-white">Store (Demand Node)</span>
        </div>
        <div className="h-px bg-neutral-800 my-1" />
        <div className="flex items-center space-x-2">
          <div className="flex items-center px-1 py-0.5 bg-black border border-white text-[9px] text-white font-mono font-bold space-x-1">
            <span>TRK</span>
            <span className="text-[8px]">&gt;</span>
          </div>
          <span className="text-white">Fleet Truck (Dispatched)</span>
        </div>
      </div>
    </div>
  );
};
