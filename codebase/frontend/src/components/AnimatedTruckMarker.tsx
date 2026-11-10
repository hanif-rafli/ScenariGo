import React, { useEffect, useRef, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { TruckInstance, DispatchItinerary } from '../types/simulation';
import {
  computeCumulativeDistances,
  interpolatePathPosition,
} from '../utils/geoAnimation';

interface AnimatedTruckMarkerProps {
  truck: TruckInstance;
  itinerary?: DispatchItinerary | null;
  truckIndex?: number;
  coRoutedIndex?: number;
  totalCoRouted?: number;
}

type LegPhase = 'DEADHEAD' | 'LOADING' | 'HAUL' | 'UNLOADING' | 'RETURN' | 'REST';

interface PhaseConfig {
  phase: LegPhase;
  label: string;
  durationMs: number;
  waypoints?: [number, number][];
  cumulativeDistances?: number[];
  totalDistanceKm: number;
  originName: string;
  destinationName: string;
}

const VIRTUAL_SPEED_KM_PER_SEC = 18.0; // Simulated km per second
const LOADING_DWELL_MS = 1500;
const UNLOADING_DWELL_MS = 2000;

export const AnimatedTruckMarker: React.FC<AnimatedTruckMarkerProps> = ({
  truck,
  itinerary,
  truckIndex = 0,
  coRoutedIndex = 0,
  totalCoRouted = 1,
}) => {
  const markerRef = useRef<L.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Fallback initial position
  const initialPos: [number, number] = truck.current_coords || [3.139, 101.6869];

  // UI state for telemetry popup (throttled updates)
  const [telemetry, setTelemetry] = useState<{
    phaseLabel: string;
    legProgressPct: number;
    distanceCoveredKm: number;
    currentSpeedKmH: number;
    origin: string;
    destination: string;
  }>({
    phaseLabel: itinerary ? '[EN ROUTE]' : '[PARKED AT DEPOT]',
    legProgressPct: 0,
    distanceCoveredKm: 0,
    currentSpeedKmH: itinerary ? 75 : 0,
    origin: truck.current_location_name,
    destination: itinerary?.target_store_name || truck.current_location_name,
  });

  const lastTelemetryUpdateRef = useRef<number>(0);

  // Prepare journey phases from itinerary
  const phasesRef = useRef<PhaseConfig[]>([]);

  useEffect(() => {
    if (!itinerary || !itinerary.legs || itinerary.legs.length === 0) {
      phasesRef.current = [];
      return;
    }

    const phases: PhaseConfig[] = [];

    // Check for Deadhead Leg
    const deadheadLeg = itinerary.legs.find(
      (l) => l.leg_type === 'DEADHEAD_PICKUP'
    );
    if (deadheadLeg && deadheadLeg.path_coordinates && deadheadLeg.path_coordinates.length > 1) {
      const cum = computeCumulativeDistances(deadheadLeg.path_coordinates);
      const totalDist = cum[cum.length - 1];
      const travelMs = Math.max(800, (totalDist / VIRTUAL_SPEED_KM_PER_SEC) * 1000);

      phases.push({
        phase: 'DEADHEAD',
        label: '[REPOSITIONING TO PICKUP]',
        durationMs: travelMs,
        waypoints: deadheadLeg.path_coordinates,
        cumulativeDistances: cum,
        totalDistanceKm: totalDist,
        originName: deadheadLeg.origin_name,
        destinationName: deadheadLeg.destination_name,
      });

      // Loading Dwell at pickup warehouse
      phases.push({
        phase: 'LOADING',
        label: '[LOADING AT WAREHOUSE]',
        durationMs: LOADING_DWELL_MS,
        totalDistanceKm: 0,
        originName: deadheadLeg.destination_name,
        destinationName: deadheadLeg.destination_name,
      });
    } else {
      // Direct load at source warehouse
      phases.push({
        phase: 'LOADING',
        label: '[LOADING AT WAREHOUSE]',
        durationMs: LOADING_DWELL_MS,
        totalDistanceKm: 0,
        originName: itinerary.source_warehouse_name,
        destinationName: itinerary.source_warehouse_name,
      });
    }

    // Haul Delivery Leg
    const haulLeg = itinerary.legs.find(
      (l) => l.leg_type === 'HAUL_DELIVERY'
    );
    if (haulLeg && haulLeg.path_coordinates && haulLeg.path_coordinates.length > 0) {
      const cum = computeCumulativeDistances(haulLeg.path_coordinates);
      const totalDist = cum[cum.length - 1];
      const travelMs = Math.max(1200, (totalDist / VIRTUAL_SPEED_KM_PER_SEC) * 1000);

      phases.push({
        phase: 'HAUL',
        label: '[HAUL DELIVERY TO STORE]',
        durationMs: travelMs,
        waypoints: haulLeg.path_coordinates,
        cumulativeDistances: cum,
        totalDistanceKm: totalDist,
        originName: haulLeg.origin_name,
        destinationName: haulLeg.destination_name,
      });
    }

    // Unloading Dwell at Retail Store
    phases.push({
      phase: 'UNLOADING',
      label: '[UNLOADING AT STORE]',
      durationMs: UNLOADING_DWELL_MS,
      totalDistanceKm: 0,
      originName: itinerary.target_store_name,
      destinationName: itinerary.target_store_name,
    });

    // Return Leg: Return to depot or warehouse along the highway (smooth closed loop, zero teleportation)
    let returnWaypoints: [number, number][] = [];
    let returnOriginName = itinerary.target_store_name;
    let returnDestName = truck.current_location_name;

    if (deadheadLeg && deadheadLeg.path_coordinates && deadheadLeg.path_coordinates.length > 1) {
      // Truck has deadhead leg: was repositioned from home depot to warehouse, then delivered to store.
      // E.g. Penang -> KL Hub -> Ipoh. Return path should take the highway from Ipoh back to Penang!
      const storeCoord =
        haulLeg && haulLeg.path_coordinates && haulLeg.path_coordinates.length > 0
          ? haulLeg.path_coordinates[haulLeg.path_coordinates.length - 1]
          : initialPos;

      // Check if storeCoord is close to a waypoint on the deadhead path (e.g. Ipoh on Penang->KL)
      let closestIdx = -1;
      let minDist = Infinity;
      deadheadLeg.path_coordinates.forEach((pt, idx) => {
        const d = Math.hypot(pt[0] - storeCoord[0], pt[1] - storeCoord[1]);
        if (d < minDist) {
          minDist = d;
          closestIdx = idx;
        }
      });

      if (closestIdx >= 0 && minDist < 0.08) {
        // Store is along the deadhead corridor (e.g. Ipoh on North-South Expressway between Penang & KL)
        // Return directly from store along the highway to home depot (slice and reverse)
        returnWaypoints = deadheadLeg.path_coordinates.slice(0, closestIdx + 1).reverse();
      } else {
        // Return via warehouse then back to depot
        const revHaul = haulLeg?.path_coordinates ? [...haulLeg.path_coordinates].reverse() : [];
        const revDeadhead = [...deadheadLeg.path_coordinates].reverse();
        returnWaypoints = [...revHaul, ...revDeadhead.slice(1)];
      }
    } else if (haulLeg && haulLeg.path_coordinates && haulLeg.path_coordinates.length > 1) {
      // Truck started at warehouse: returns from store back to warehouse along reversed haul path
      returnWaypoints = [...haulLeg.path_coordinates].reverse();
      returnDestName = itinerary.source_warehouse_name;
    }

    if (returnWaypoints.length > 1) {
      const cum = computeCumulativeDistances(returnWaypoints);
      const totalDist = cum[cum.length - 1];
      const travelMs = Math.max(1200, (totalDist / VIRTUAL_SPEED_KM_PER_SEC) * 1000);

      phases.push({
        phase: 'RETURN',
        label: '[RETURNING TO BASE]',
        durationMs: travelMs,
        waypoints: returnWaypoints,
        cumulativeDistances: cum,
        totalDistanceKm: totalDist,
        originName: returnOriginName,
        destinationName: returnDestName,
      });

      // Turnaround dwell at base before starting next cycle
      phases.push({
        phase: 'REST',
        label: '[DEPOT TURNAROUND / READY]',
        durationMs: 1500,
        totalDistanceKm: 0,
        originName: returnDestName,
        destinationName: returnDestName,
      });
    }

    phasesRef.current = phases;
  }, [itinerary, initialPos, truck.current_location_name]);

  // Animation Loop via requestAnimationFrame
  useEffect(() => {
    if (!itinerary || phasesRef.current.length === 0) {
      if (markerRef.current) {
        const parkOffset = (truckIndex % 4) - 1.5;
        markerRef.current.setLatLng([
          initialPos[0] + parkOffset * 0.00025,
          initialPos[1] + parkOffset * 0.00025,
        ]);
      }
      return;
    }

    let startTime: number | null = null;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;

      const phases = phasesRef.current;
      if (phases.length === 0) return;

      const totalCycleDuration = phases.reduce((acc, p) => acc + p.durationMs, 0);

      // Stagger dispatch headway across co-routed vehicles (e.g. TRK-004 and TRK-005 in Kuching)
      // Offsets start phase so one truck delivers while the other returns in alternating waves
      const headwayOffsetMs =
        totalCoRouted > 1 ? (coRoutedIndex / totalCoRouted) * totalCycleDuration : 0;
      const cycleTime = (elapsed + headwayOffsetMs) % totalCycleDuration;

      // Find current active phase
      let accumulatedTime = 0;
      let activePhase = phases[0];
      let phaseTime = 0;

      for (const p of phases) {
        if (cycleTime >= accumulatedTime && cycleTime < accumulatedTime + p.durationMs) {
          activePhase = p;
          phaseTime = cycleTime - accumulatedTime;
          break;
        }
        accumulatedTime += p.durationMs;
      }

      const phaseProgress = Math.min(1.0, Math.max(0.0, phaseTime / activePhase.durationMs));

      let currentCoords: [number, number] = initialPos;
      let bearing = 0;
      let distCovered = 0;

      if (
        (activePhase.phase === 'DEADHEAD' ||
          activePhase.phase === 'HAUL' ||
          activePhase.phase === 'RETURN') &&
        activePhase.waypoints &&
        activePhase.cumulativeDistances
      ) {
        distCovered = phaseProgress * activePhase.totalDistanceKm;
        const interp = interpolatePathPosition(
          activePhase.waypoints,
          activePhase.cumulativeDistances,
          distCovered
        );
        if (interp) {
          currentCoords = interp.position;
          bearing = interp.bearing;
        }
      } else if (activePhase.phase === 'LOADING') {
        // Paused at warehouse
        const prevPhase = phases[0];
        if (prevPhase.waypoints && prevPhase.waypoints.length > 0) {
          currentCoords = prevPhase.waypoints[prevPhase.waypoints.length - 1];
        } else {
          currentCoords = initialPos;
        }
        distCovered = 0;
      } else if (activePhase.phase === 'UNLOADING') {
        // Paused at store
        const haulPhase = phases.find((p) => p.phase === 'HAUL');
        if (haulPhase && haulPhase.waypoints && haulPhase.waypoints.length > 0) {
          currentCoords = haulPhase.waypoints[haulPhase.waypoints.length - 1];
        } else {
          currentCoords = initialPos;
        }
        distCovered = haulPhase?.totalDistanceKm || 0;
      } else if (activePhase.phase === 'REST') {
        // Paused at home depot / warehouse
        currentCoords = initialPos;
        distCovered = 0;
      }

      // Calculate lateral lane offset (dual-carriageway separation) and dwell position shift
      let displayCoords: [number, number] = currentCoords;

      if (
        activePhase.phase === 'DEADHEAD' ||
        activePhase.phase === 'HAUL' ||
        activePhase.phase === 'RETURN'
      ) {
        if (totalCoRouted > 1) {
          // Offset perpendicular to vehicle travel bearing by ~16 meters (0.00018 deg)
          const laneSign = coRoutedIndex % 2 === 0 ? -1 : 1;
          const laneDistDeg = 0.00018 * laneSign;
          const perpBearingRad = ((bearing + 90) * Math.PI) / 180;
          displayCoords = [
            currentCoords[0] + laneDistDeg * Math.cos(perpBearingRad),
            currentCoords[1] + laneDistDeg * Math.sin(perpBearingRad),
          ];
        }
      } else {
        // Subtle offset during loading/unloading dwells so stopped trucks do not stack directly
        if (totalCoRouted > 1) {
          const stopSign = coRoutedIndex % 2 === 0 ? -1 : 1;
          displayCoords = [
            currentCoords[0] + 0.00022 * stopSign,
            currentCoords[1] + 0.00018 * stopSign,
          ];
        }
      }

      // Update Marker position directly without React re-render
      if (markerRef.current) {
        markerRef.current.setLatLng(displayCoords);

        // Update bearing arrow rotation via DOM transform
        const el = markerRef.current.getElement();
        if (el) {
          const arrowEl = el.querySelector<HTMLElement>(`.bearing-arrow-${truck.truck_id}`);
          if (arrowEl) {
            arrowEl.style.transform = `rotate(${bearing}deg)`;
          }
        }
      }

      // Throttle telemetry state updates to ~4 times per second (every 250ms)
      if (currentTime - lastTelemetryUpdateRef.current > 250) {
        lastTelemetryUpdateRef.current = currentTime;
        setTelemetry({
          phaseLabel: activePhase.label,
          legProgressPct: Math.round(phaseProgress * 100),
          distanceCoveredKm: Math.round(distCovered * 10) / 10,
          currentSpeedKmH:
            activePhase.phase === 'LOADING' ||
            activePhase.phase === 'UNLOADING' ||
            activePhase.phase === 'REST'
              ? 0
              : 70,
          origin: activePhase.originName,
          destination: activePhase.destinationName,
        });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [itinerary, initialPos, truck.truck_id, coRoutedIndex, totalCoRouted, truckIndex]);

  // Create High-Contrast Monochrome DivIcon
  const isParked = !itinerary;

  const iconHtml = `
    <div class="flex items-center justify-center relative cursor-pointer select-none">
      <div class="flex items-center space-x-1.5 px-2 py-1 bg-black border ${
        isParked ? 'border-neutral-600 opacity-80' : 'border-white shadow-2xl ring-1 ring-white/50'
      } rounded-none font-mono text-white text-[11px] font-bold">
        <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path>
          <path d="M15 18H9"></path>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z"></path>
          <circle cx="17" cy="18" r="2"></circle>
          <circle cx="7" cy="18" r="2"></circle>
        </svg>
        <span class="tracking-wide">${truck.truck_id}</span>
        ${
          !isParked
            ? `<div class="bearing-arrow-${truck.truck_id} transition-transform duration-75 flex items-center justify-center">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
                </svg>
              </div>`
            : `<span class="text-[9px] text-neutral-400 font-normal">[PARKED]</span>`
        }
      </div>
    </div>
  `;

  const customIcon = L.divIcon({
    html: iconHtml,
    className: `truck-marker-${truck.truck_id}`,
    iconSize: [85, 26],
    iconAnchor: [42, totalCoRouted > 1 ? (coRoutedIndex % 2 === 1 ? 22 : 4) : 13],
    popupAnchor: [0, -15],
  });

  return (
    <Marker ref={markerRef} position={initialPos} icon={customIcon}>
      <Popup>
        <div className="p-1 min-w-[230px] font-mono text-white space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-700 pb-1.5">
            <span className="font-bold text-xs tracking-wider">{truck.truck_id}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-none font-bold ${
                isParked
                  ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  : 'bg-white text-black'
              }`}
            >
              {isParked ? '[IDLE / PARKED]' : '[ACTIVE DISPATCH]'}
            </span>
          </div>

          {/* Vehicle Model & Fleet Details */}
          <div className="text-[11px] text-neutral-300">
            <div className="font-bold text-white">{truck.name}</div>
            <div className="text-[10px] text-neutral-400">
              Payload: {truck.payload_capacity_kg} kg | Tank: {truck.fuel_tank_capacity_l}L
            </div>
          </div>

          {/* Mission Telemetry */}
          {itinerary ? (
            <div className="space-y-1.5 border-t border-neutral-800 pt-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-neutral-400">Mission Phase:</span>
                <span className="text-white font-bold">{telemetry.phaseLabel}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-neutral-400">Origin:</span>
                <span className="text-white font-semibold truncate max-w-[140px]">
                  {telemetry.origin}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-neutral-400">Destination:</span>
                <span className="text-white font-semibold truncate max-w-[140px]">
                  {telemetry.destination}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-neutral-400">Manifest:</span>
                <span className="text-white font-bold">
                  {itinerary.quantity_units} units (Product P{itinerary.product_id})
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Phase Progress:</span>
                  <span className="text-white font-bold">{telemetry.legProgressPct}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 overflow-hidden">
                  <div
                    className="bg-white h-full transition-all duration-200"
                    style={{ width: `${telemetry.legProgressPct}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-neutral-400 pt-1">
                <span>Simulated Speed:</span>
                <span className="text-white font-bold">{telemetry.currentSpeedKmH} km/h</span>
              </div>
            </div>
          ) : (
            <div className="border-t border-neutral-800 pt-1.5 text-[10px] text-neutral-400">
              Stationary at {truck.current_location_name}. Awaiting allocation in Stage 4 fleet
              matching.
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
};
