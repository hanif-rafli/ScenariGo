import React, { useState } from 'react';
import { TruckInstance, DispatchItinerary } from '../types/simulation';

interface ManageFleetProps {
  fleet: TruckInstance[];
  itineraries: DispatchItinerary[];
  onAddTruck?: (newTruck: TruckInstance) => void;
  onSelectTruckTask?: (truckId: string) => void;
}

export const ManageFleet: React.FC<ManageFleetProps> = ({
  fleet,
  itineraries,
  onAddTruck,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ASSIGNED' | 'IDLE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for adding custom truck
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState<'isuzu_3ton' | 'tata_ace'>('isuzu_3ton');
  const [tankLiters, setTankLiters] = useState(100);
  const [kmpl, setKmpl] = useState(8.5);
  const [payloadKg, setPayloadKg] = useState(3500);
  const [baseLocation, setBaseLocation] = useState('Kuala Lumpur Hub');

  // Map truck_id -> assigned itinerary
  const itineraryMap: Record<string, DispatchItinerary> = {};
  for (const itin of itineraries) {
    itineraryMap[itin.truck_id] = itin;
  }

  const assignedCount = fleet.filter((t) => itineraryMap[t.truck_id] || t.is_assigned).length;
  const idleCount = fleet.length - assignedCount;

  const filteredTrucks = fleet.filter((t) => {
    const isAssigned = !!itineraryMap[t.truck_id] || t.is_assigned;
    if (filterStatus === 'ASSIGNED') return isAssigned;
    if (filterStatus === 'IDLE') return !isAssigned;
    return true;
  });

  const handleCreateTruck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTruck: TruckInstance = {
      truck_id: `TRK-${String(fleet.length + 1).padStart(3, '0')}`,
      name: name.trim(),
      model_id: modelId,
      image_url: modelId === 'isuzu_3ton' ? '/assets/trucks/isuzu_3ton.jpg' : '/assets/trucks/tata_ace.jpg',
      payload_capacity_kg: Number(payloadKg),
      fuel_economy_kmpl: Number(kmpl),
      fuel_tank_capacity_l: Number(tankLiters),
      current_location_name: baseLocation,
      current_coords: baseLocation.includes('Penang')
        ? [5.4164, 100.3327]
        : baseLocation.includes('Kuching')
        ? [1.5533, 110.3592]
        : [3.1390, 101.6869],
      is_assigned: false,
    };

    onAddTruck?.(newTruck);
    setName('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 font-mono text-white">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wider">
            Commercial Fleet Asset Management
          </h2>
          <p className="text-xs text-white">
            Physical vehicle specifications, tank capacities, and assigned store delivery missions
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-none bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors cursor-pointer"
          >
            + ADD TRUCK
          </button>
        </div>
      </div>

      {/* 2. Fleet Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-neutral-950 p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Total Fleet</div>
          <div className="text-xl font-bold mt-0.5">{fleet.length} <span className="text-xs font-normal">trucks</span></div>
        </div>
        <div className="bg-neutral-950 p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Assigned to Tasks</div>
          <div className="text-xl font-bold mt-0.5">{assignedCount} <span className="text-xs font-normal">active</span></div>
        </div>
        <div className="bg-neutral-950 p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Idle / Standby</div>
          <div className="text-xl font-bold mt-0.5">{idleCount} <span className="text-xs font-normal">ready</span></div>
        </div>
        <div className="bg-neutral-950 p-3 rounded-none">
          <div className="text-[10px] text-white uppercase tracking-wider">Total Payload Capacity</div>
          <div className="text-xl font-bold mt-0.5">
            {fleet.reduce((acc, t) => acc + t.payload_capacity_kg, 0).toLocaleString()} <span className="text-xs font-normal">kg</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls */}
      <div className="flex items-center space-x-2 text-xs border-y border-neutral-900 py-2.5">
        <span className="uppercase tracking-wider text-[11px]">Filter Fleet:</span>
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-2.5 py-1 rounded-none text-xs transition-colors cursor-pointer ${
            filterStatus === 'ALL'
              ? 'bg-white text-black font-bold'
              : 'bg-black text-white hover:bg-neutral-900'
          }`}
        >
          ALL ({fleet.length})
        </button>
        <button
          onClick={() => setFilterStatus('ASSIGNED')}
          className={`px-2.5 py-1 rounded-none text-xs transition-colors cursor-pointer ${
            filterStatus === 'ASSIGNED'
              ? 'bg-white text-black font-bold'
              : 'bg-black text-white hover:bg-neutral-900'
          }`}
        >
          ASSIGNED ({assignedCount})
        </button>
        <button
          onClick={() => setFilterStatus('IDLE')}
          className={`px-2.5 py-1 rounded-none text-xs transition-colors cursor-pointer ${
            filterStatus === 'IDLE'
              ? 'bg-white text-black font-bold'
              : 'bg-black text-white hover:bg-neutral-900'
          }`}
        >
          IDLE ({idleCount})
        </button>
      </div>

      {/* 4. Commercial Truck Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTrucks.map((truck) => {
          const task = itineraryMap[truck.truck_id];
          const isAssigned = !!task || truck.is_assigned;
          const cruisingRange = Math.round(truck.fuel_tank_capacity_l * truck.fuel_economy_kmpl);

          return (
            <div
              key={truck.truck_id}
              className="bg-neutral-950 rounded-none overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Real Commercial Truck Photography */}
                <div className="relative w-full h-44 bg-black overflow-hidden rounded-none">
                  <img
                    src={truck.image_url}
                    alt={truck.name}
                    className="w-full h-full object-cover transition-transform hover:scale-105 duration-300 rounded-none"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/trucks/isuzu_3ton.jpg';
                    }}
                  />
                  <div className="absolute top-2 left-2 bg-black px-2 py-0.5 rounded-none border border-neutral-700 text-[10px] text-white font-bold">
                    {truck.truck_id}
                  </div>
                  <div className="absolute top-2 right-2">
                    {isAssigned ? (
                      <span className="px-2 py-0.5 rounded-none bg-black border border-white text-white text-[10px] font-bold">
                        [ASSIGNED]
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-none bg-neutral-900 text-white text-[10px] font-bold">
                        [IDLE]
                      </span>
                    )}
                  </div>
                </div>

                {/* Truck Identification */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold tracking-wide">{truck.name}</h3>
                    <div className="text-xs text-white mt-0.5">
                      Base: {truck.current_location_name}
                    </div>
                  </div>

                  {/* Physical Specifications (2x2 Grid) */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-black p-2.5 rounded-none">
                    <div>
                      <span className="text-[10px] block uppercase">Tank Size</span>
                      <span className="font-bold">{truck.fuel_tank_capacity_l} L</span>
                    </div>
                    <div>
                      <span className="text-[10px] block uppercase">Efficiency</span>
                      <span className="font-bold">{truck.fuel_economy_kmpl} km/L</span>
                    </div>
                    <div>
                      <span className="text-[10px] block uppercase">Payload</span>
                      <span className="font-bold">{truck.payload_capacity_kg.toLocaleString()} kg</span>
                    </div>
                    <div>
                      <span className="text-[10px] block uppercase">Max Range</span>
                      <span className="font-bold">{cruisingRange} km</span>
                    </div>
                  </div>

                  {/* Allocated Task Section */}
                  <div className="border-t border-neutral-900 pt-3 space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider font-bold">
                      Allocated Delivery Task:
                    </div>

                    {task ? (
                      <div className="bg-black p-2.5 rounded-none space-y-2 text-xs">
                        <div className="flex justify-between items-center text-white">
                          <span className="font-bold">
                            Deliver to: {task.target_store_name}
                          </span>
                          <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 text-[10px] font-bold rounded-none">
                            P{task.product_id} &times; {task.quantity_units} units
                          </span>
                        </div>

                        <div className="text-[11px]">
                          Pickup: <span className="font-bold">{task.source_warehouse_name}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-neutral-900 text-[10px] font-mono">
                          <div>
                            <span className="block">Distance</span>
                            <span className="font-bold">{task.total_distance_km} km</span>
                          </div>
                          <div>
                            <span className="block">Fuel Used</span>
                            <span className="font-bold">{task.total_fuel_liters} L</span>
                          </div>
                          <div>
                            <span className="block">Fuel Cost</span>
                            <span className="font-bold">MYR {task.total_fuel_cost_myr.toFixed(2)}</span>
                          </div>
                        </div>

                        {task.is_refueled && (
                          <div className="text-[10px] bg-neutral-900 border border-white p-1.5 rounded-none">
                            Includes Refueling Stop: {task.refueling_stops[0]?.station_name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-black p-2.5 rounded-none text-xs italic">
                        [IDLE] Vehicle is on standby in depot. No task assigned for this round.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Add Truck Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white rounded-none max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Add Vehicle to Fleet
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white hover:underline text-xs font-bold cursor-pointer"
              >
                [X]
              </button>
            </div>

            <form onSubmit={handleCreateTruck} className="space-y-3 text-xs">
              <div>
                <label className="block text-white uppercase text-[10px] mb-1">
                  Truck Name / Identifier
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Isuzu Forward 3-Ton #04"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black border border-neutral-700 focus:border-white px-3 py-2 rounded-none text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-white uppercase text-[10px] mb-1">
                  Vehicle Commercial Model
                </label>
                <select
                  value={modelId}
                  onChange={(e) => {
                    const val = e.target.value as 'isuzu_3ton' | 'tata_ace';
                    setModelId(val);
                    if (val === 'isuzu_3ton') {
                      setTankLiters(100);
                      setKmpl(8.5);
                      setPayloadKg(3500);
                    } else {
                      setTankLiters(26);
                      setKmpl(22.0);
                      setPayloadKg(900);
                    }
                  }}
                  className="w-full bg-black border border-neutral-700 focus:border-white px-3 py-2 rounded-none text-white font-mono outline-none"
                >
                  <option value="isuzu_3ton">Isuzu 3-Ton Box Lorry (3,500 kg Payload)</option>
                  <option value="tata_ace">Tata Ace Gold Mini Truck (900 kg Payload)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white uppercase text-[10px] mb-1">
                    Tank Capacity (L)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    step="1"
                    value={tankLiters}
                    onChange={(e) => setTankLiters(Number(e.target.value))}
                    className="w-full bg-black border border-neutral-700 focus:border-white px-3 py-2 rounded-none text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white uppercase text-[10px] mb-1">
                    Fuel Economy (km/L)
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="35"
                    step="0.5"
                    value={kmpl}
                    onChange={(e) => setKmpl(Number(e.target.value))}
                    className="w-full bg-black border border-neutral-700 focus:border-white px-3 py-2 rounded-none text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white uppercase text-[10px] mb-1">
                    Payload Limit (kg)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="20000"
                    step="50"
                    value={payloadKg}
                    onChange={(e) => setPayloadKg(Number(e.target.value))}
                    className="w-full bg-black border border-neutral-700 focus:border-white px-3 py-2 rounded-none text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-white uppercase text-[10px] mb-1">
                    Base Station
                  </label>
                  <select
                    value={baseLocation}
                    onChange={(e) => setBaseLocation(e.target.value)}
                    className="w-full bg-black border border-neutral-700 focus:border-white px-3 py-2 rounded-none text-white font-mono outline-none"
                  >
                    <option value="Kuala Lumpur Hub">Kuala Lumpur Hub</option>
                    <option value="Penang Logistics Dep">Penang Logistics Dep</option>
                    <option value="Kuching Transshipment">Kuching Transshipment</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-900 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-black hover:bg-neutral-900 text-white rounded-none text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-white hover:bg-neutral-200 text-black font-bold rounded-none text-xs transition-colors cursor-pointer"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
