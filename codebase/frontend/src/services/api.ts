import {
  SimulationRequest,
  Stage1Result,
  Stage2Result,
  Stage3Result,
  Stage4Result,
  TruckInstance,
  ScenarioSummary,
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

// =============================================================================
// Scenario Persistence & Organization Master Data API
// =============================================================================

export async function fetchScenariosList(): Promise<ScenarioSummary[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/scenarios`);
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('scenarigo_scenarios_summaries', JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Backend unavailable, reading scenarios from localStorage:', err);
  }
  const cached = localStorage.getItem('scenarigo_scenarios_summaries');
  if (cached) {
    return JSON.parse(cached);
  }
  return [];
}

export async function fetchActiveScenario(): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/scenarios/active`);
  if (!res.ok) {
    throw new Error(`Failed to fetch active scenario: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchScenarioById(scenarioId: string): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/scenarios/${scenarioId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch scenario '${scenarioId}': ${res.statusText}`);
  }
  return res.json();
}

export async function createScenario(scenario: SimulationRequest): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) {
    throw new Error(`Failed to create scenario: ${res.statusText}`);
  }
  return res.json();
}

export async function updateScenario(scenarioId: string, scenario: SimulationRequest): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/scenarios/${scenarioId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) {
    throw new Error(`Failed to update scenario: ${res.statusText}`);
  }
  return res.json();
}

export async function activateScenario(scenarioId: string): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/scenarios/${scenarioId}/activate`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to activate scenario: ${res.statusText}`);
  }
  return res.json();
}

export async function resetPresetScenario(scenarioId: string): Promise<SimulationRequest> {
  const res = await fetch(`${API_BASE_URL}/api/v1/scenarios/${scenarioId}/reset`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to reset preset: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/scenarios/${scenarioId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete scenario: ${res.statusText}`);
  }
}
