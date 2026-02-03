export const LOCATION_CLUSTER_RADIUS_METERS = 25;

export function parseLocation(location: string | null): { lat: number; lon: number } | null {
  if (!location) return null;

  // Try PostGIS format: POINT(lon lat)
  const pointMatch = location.match(/POINT\(([^ ]+)\s+([^ ]+)\)/);
  if (pointMatch) {
    const lon = parseFloat(pointMatch[1]!);
    const lat = parseFloat(pointMatch[2]!);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }
  }

  // Try JSON format
  try {
    const parsed = JSON.parse(location) as Record<string, unknown>;
    if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
      return { lat: parsed.lat, lon: parsed.lon };
    }
    if (typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
      return { lat: parsed.latitude, lon: parsed.longitude };
    }
  } catch {
    // Not JSON
  }

  return null;
}

export function haversineDistanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function formatLatLonKey(lat: number, lon: number, precision = 6) {
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
}
