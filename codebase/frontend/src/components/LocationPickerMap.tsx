import React, { useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Warehouse, Store } from '../types/simulation';
import { MapPin, Navigation } from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onChangeLocation: (lat: number, lng: number) => void;
  existingWarehouses?: Warehouse[];
  existingStores?: Store[];
  label?: string;
}

// Quick Malaysian preset hubs for convenient pin-dropping
const MALAYSIA_PRESET_HUBS = [
  { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869, region: 'Peninsular' },
  { name: 'Port Klang', lat: 2.9985, lng: 101.3928, region: 'Peninsular' },
  { name: 'Penang (Butterworth)', lat: 5.4164, lng: 100.3327, region: 'Peninsular' },
  { name: 'Johor Bahru (PTP)', lat: 1.362, lng: 103.551, region: 'Peninsular' },
  { name: 'Kuantan Port', lat: 3.978, lng: 103.428, region: 'Peninsular' },
  { name: 'Kuching Port', lat: 1.5533, lng: 110.3592, region: 'East Malaysia' },
  { name: 'Kota Kinabalu Port', lat: 5.9804, lng: 116.0735, region: 'East Malaysia' },
  { name: 'Bintulu Deepwater Port', lat: 3.256, lng: 113.068, region: 'East Malaysia' },
];

// Target Draggable Marker Icon (High-contrast bright white/cyan target)
const createPickerIcon = (label?: string) => {
  const iconHtml = renderToString(
    <div className="relative flex flex-col items-center">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-400 text-black border-2 border-white shadow-2xl animate-pulse">
        <MapPin className="w-5 h-5 stroke-[2.5]" />
      </div>
      <div className="mt-1 px-1.5 py-0.5 bg-black border border-cyan-400 text-cyan-300 text-[9px] font-mono font-bold tracking-tight whitespace-nowrap shadow-md">
        {label ?? 'DRAG / CLICK'}
      </div>
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-picker-pin',
    iconSize: [40, 50],
    iconAnchor: [20, 24],
  });
};

// Muted outline icon for existing facilities
const createMutedFacilityIcon = (isWarehouse: boolean) => {
  const iconHtml = renderToString(
    <div
      className={`w-3.5 h-3.5 rounded-full border ${
        isWarehouse
          ? 'bg-neutral-800 border-neutral-400'
          : 'bg-neutral-900 border-neutral-600'
      }`}
    />
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-muted-facility',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

// Map click event listener component
const MapClickHandler: React.FC<{
  onLocationSelected: (lat: number, lng: number) => void;
}> = ({ onLocationSelected }) => {
  useMapEvents({
    click(e) {
      onLocationSelected(
        Number(e.latlng.lat.toFixed(4)),
        Number(e.latlng.lng.toFixed(4))
      );
    },
  });
  return null;
};

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  latitude,
  longitude,
  onChangeLocation,
  existingWarehouses = [],
  existingStores = [],
  label,
}) => {
  const markerRef = useRef<L.Marker | null>(null);

  // Region determination
  const isEastMalaysia = longitude >= 105.0;
  const regionBadge = isEastMalaysia
    ? '[EAST MALAYSIA / BORNEO (SARAWAK / SABAH)]'
    : '[PENINSULAR MALAYSIA (WEST)]';

  const pickerIcon = useMemo(() => createPickerIcon(label), [label]);
  const warehouseMutedIcon = useMemo(() => createMutedFacilityIcon(true), []);
  const storeMutedIcon = useMemo(() => createMutedFacilityIcon(false), []);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onChangeLocation(
            Number(latLng.lat.toFixed(4)),
            Number(latLng.lng.toFixed(4))
          );
        }
      },
    }),
    [onChangeLocation]
  );

  return (
    <div className="space-y-3 font-mono text-white">
      {/* Map Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-neutral-400 uppercase tracking-wider text-[11px]">
            GIS Coordinate Picker:
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold ${
              isEastMalaysia
                ? 'bg-blue-950 text-blue-300 border border-blue-700'
                : 'bg-amber-950 text-amber-300 border border-amber-700'
            }`}
          >
            {regionBadge}
          </span>
        </div>
        <div className="text-[10px] text-neutral-400">
          Click map or drag pin to position
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative h-64 w-full border border-neutral-800 bg-black overflow-hidden">
        <MapContainer
          center={[latitude || 3.139, longitude || 101.6869]}
          zoom={6}
          scrollWheelZoom={true}
          className="h-full w-full"
          style={{ background: '#000000' }}
        >
          {/* Public OpenStreetMap with dark monochrome CSS filter */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="monochrome-map-tiles"
          />

          <MapClickHandler onLocationSelected={onChangeLocation} />

          {/* Target Draggable Marker */}
          <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={[latitude || 3.139, longitude || 101.6869]}
            ref={markerRef}
            icon={pickerIcon}
          >
            <Popup className="dark-leaflet-popup">
              <div className="bg-neutral-950 text-white p-2 font-mono text-xs">
                <div className="font-bold text-cyan-400">{label ?? 'Target Facility'}</div>
                <div className="text-[11px] text-neutral-300 mt-1">
                  Lat: {latitude.toFixed(4)}, Lng: {longitude.toFixed(4)}
                </div>
                <div className="text-[10px] text-neutral-500 mt-1">
                  Drag marker or click anywhere on map
                </div>
              </div>
            </Popup>
          </Marker>

          {/* Reference: Existing Warehouses */}
          {existingWarehouses.map((w) => (
            <Marker
              key={`ref-w-${w.warehouse_id}`}
              position={[w.latitude, w.longitude]}
              icon={warehouseMutedIcon}
            >
              <Popup className="dark-leaflet-popup">
                <div className="bg-neutral-950 text-white p-1.5 font-mono text-xs">
                  <span className="text-neutral-400">[WAREHOUSE]</span> {w.name}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Reference: Existing Stores */}
          {existingStores.map((s) => (
            <Marker
              key={`ref-s-${s.store_id}`}
              position={[s.latitude, s.longitude]}
              icon={storeMutedIcon}
            >
              <Popup className="dark-leaflet-popup">
                <div className="bg-neutral-950 text-white p-1.5 font-mono text-xs">
                  <span className="text-neutral-400">[STORE]</span> {s.name}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Manual Numeric Coordinate Entry & Quick Presets */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
              Latitude (Decimal Degrees)
            </label>
            <input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) =>
                onChangeLocation(parseFloat(e.target.value) || 0, longitude)
              }
              className="w-full bg-neutral-950 border border-neutral-800 text-white text-xs px-2.5 py-1.5 font-mono focus:border-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-neutral-400 uppercase tracking-wider mb-1">
              Longitude (Decimal Degrees)
            </label>
            <input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) =>
                onChangeLocation(latitude, parseFloat(e.target.value) || 0)
              }
              className="w-full bg-neutral-950 border border-neutral-800 text-white text-xs px-2.5 py-1.5 font-mono focus:border-white focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Hub Jump Shortcuts */}
        <div>
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
            Quick Snap To Logistics Hub:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MALAYSIA_PRESET_HUBS.map((hub) => (
              <button
                key={hub.name}
                type="button"
                onClick={() => onChangeLocation(hub.lat, hub.lng)}
                className="px-2 py-0.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-[10px] text-neutral-300 transition-colors cursor-pointer"
              >
                [{hub.name}]
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
