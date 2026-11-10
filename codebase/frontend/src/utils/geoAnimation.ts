/**
 * GIS Spatial Animation Utilities for Highway Route Interpolation.
 * Provides high-precision distance, bearing, and polyline position interpolation.
 */

export interface PathInterpolationResult {
  position: [number, number];
  bearing: number; // degrees 0-360
  segmentIndex: number;
}

/**
 * Calculates great-circle Haversine distance between two points in kilometers.
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates forward azimuth bearing angle in degrees [0, 360) from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Precomputes cumulative distance markers along an array of polyline waypoints.
 */
export function computeCumulativeDistances(
  waypoints: [number, number][]
): number[] {
  if (waypoints.length <= 1) {
    return [0];
  }

  const cumulative: number[] = [0];
  let total = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist = haversineKm(
      waypoints[i][0],
      waypoints[i][1],
      waypoints[i + 1][0],
      waypoints[i + 1][1]
    );
    total += dist;
    cumulative.push(total);
  }

  return cumulative;
}

/**
 * Linearly interpolates a position along a polyline given a covered distance in km.
 */
export function interpolatePathPosition(
  waypoints: [number, number][],
  cumulativeDistances: number[],
  targetDistKm: number
): PathInterpolationResult | null {
  if (!waypoints || waypoints.length === 0) {
    return null;
  }

  if (waypoints.length === 1) {
    return {
      position: waypoints[0],
      bearing: 0,
      segmentIndex: 0,
    };
  }

  const totalDist = cumulativeDistances[cumulativeDistances.length - 1];
  if (totalDist <= 0.0001) {
    return {
      position: waypoints[0],
      bearing: 0,
      segmentIndex: 0,
    };
  }

  const clampedDist = Math.max(0, Math.min(targetDistKm, totalDist));

  // Find segment containing clampedDist
  let low = 0;
  let high = cumulativeDistances.length - 1;

  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (cumulativeDistances[mid] <= clampedDist) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const segStartDist = cumulativeDistances[low];
  const segEndDist = cumulativeDistances[low + 1];
  const segLength = segEndDist - segStartDist;

  const t = segLength > 0 ? (clampedDist - segStartDist) / segLength : 0;

  const p1 = waypoints[low];
  const p2 = waypoints[low + 1];

  const lat = p1[0] + (p2[0] - p1[0]) * t;
  const lng = p1[1] + (p2[1] - p1[1]) * t;

  const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

  return {
    position: [lat, lng],
    bearing,
    segmentIndex: low,
  };
}
