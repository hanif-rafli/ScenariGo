import {
  SimulationRequest,
  Stage1Result,
  Stage2Result,
  Stage3Result,
  Stage4Result,
  TruckInstance,
} from '../types/simulation';

const API_BASE_URL = 'http://127.0.0.1:8000';

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function fetchBobStationeryPreset(): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/presets/bob-stationery`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Bob's Stationery preset: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDeficitPreset(): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/presets/deficit-sample`);
  if (!res.ok) {
    throw new Error(`Failed to fetch deficit preset: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAirFreightPreset(): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/presets/air-freight`);
  if (!res.ok) {
    throw new Error(`Failed to fetch air freight preset: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTriPortPreset(): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/presets/tri-port`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tri-port preset: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateFeasibility(request: SimulationRequest): Promise<Stage1Result> {
  const res = await fetch(`${API_BASE_URL}/api/v1/feasibility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Feasibility evaluation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateReachability(request: SimulationRequest): Promise<Stage2Result> {
  const res = await fetch(`${API_BASE_URL}/api/v1/reachability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Reachability evaluation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateNetworkFlow(request: SimulationRequest): Promise<Stage3Result> {
  const res = await fetch(`${API_BASE_URL}/api/v1/flow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Network flow evaluation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTruckFleet(): Promise<TruckInstance[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/fleet/trucks`);
  if (!res.ok) {
    throw new Error(`Failed to fetch truck fleet: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateFleetRouting(request: SimulationRequest): Promise<Stage4Result> {
  const res = await fetch(`${API_BASE_URL}/api/v1/fleet/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Fleet routing evaluation failed: ${res.statusText}`);
  }
  return res.json();
}
