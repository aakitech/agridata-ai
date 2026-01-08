import { format, subDays, endOfDay, startOfDay } from "date-fns";

/**
 * Get the last N days (rolling window from today)
 * Returns the period from N days ago (00:00) to end of today (23:59:59.999)
 * @param days - Number of days to go back (default: 7)
 */
export function getLastCompletedWeek(days: number = 7): { startDate: Date; endDate: Date } {
  const now = new Date();
  
  // Get end of today (23:59:59.999)
  const endDate = endOfDay(now);
  
  // Go back N days from today and get start of that day (00:00)
  const startDate = startOfDay(subDays(now, days));
  
  return {
    startDate,
    endDate,
  };
}

/**
 * Format date range for display and filename
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}`;
}

/**
 * Parse location string to extract lat/lng
 * Supports formats:
 * - "POINT(lon lat)" (PostGIS format)
 * - JSON: { lat, lon } or { latitude, longitude }
 */
export function parseLocation(location: string | null): { lat: number; lon: number } | null {
  if (!location) return null;
  
  // Try PostGIS format: POINT(lon lat)
  const pointMatch = location.match(/POINT\(([^ ]+)\s+([^ ]+)\)/);
  if (pointMatch) {
    return {
      lon: parseFloat(pointMatch[1]!),
      lat: parseFloat(pointMatch[2]!),
    };
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
    // Not JSON, ignore
  }
  
  return null;
}

