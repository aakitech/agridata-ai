export function toObservedLocalDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Failed to build observed local date for timezone ${timezone}`);
  }
  return `${year}-${month}-${day}`;
}

export function computeGridKey(lat: number, lon: number, observedLocalDate: string): string {
  // 0.1° buckets (~11km) for provider/cost-efficient reuse in v1.
  return `${lat.toFixed(1)}:${lon.toFixed(1)}:${observedLocalDate}`;
}

