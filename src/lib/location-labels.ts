export type LocationAddress = {
  road?: string;
  neighborhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
};

type LocationLabelMode = "compact" | "detailed";
type CoordsDisplayMode = "auto" | "always" | "never";

export function formatCoords(
  coords: { lat: number; lon: number } | null,
  precision: number
) {
  if (!coords) return null;
  return `${coords.lat.toFixed(precision)}, ${coords.lon.toFixed(precision)}`;
}

function uniqueParts(parts: Array<string | undefined>) {
  const unique: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (!unique.includes(part)) unique.push(part);
  }
  return unique;
}

function getIsCoarse(address?: LocationAddress | null) {
  if (!address) return true;
  const hasFine =
    !!address.road ||
    !!address.neighborhood ||
    !!address.suburb ||
    !!address.village ||
    !!address.town;
  return !hasFine;
}

export function buildLocationLabel(
  address: LocationAddress | null | undefined,
  coords: { lat: number; lon: number } | null,
  options: {
    mode: LocationLabelMode;
    coordsMode?: CoordsDisplayMode;
    coordsPrecision?: number;
  }
) {
  const coordsMode = options.coordsMode ?? "auto";
  const coordsPrecision = options.coordsPrecision ?? (options.mode === "detailed" ? 6 : 4);
  const isCoarse = getIsCoarse(address ?? null);

  let label = "Unknown location";

  if (address) {
    if (options.mode === "detailed") {
      const parts = uniqueParts([
        address.road,
        address.neighborhood,
        address.suburb,
        address.village,
        address.town,
        address.city,
        address.county,
        address.state,
        address.country,
      ]);
      if (parts.length > 0) label = parts.slice(0, 4).join(", ");
    } else {
      const parts = uniqueParts([
        address.suburb,
        address.village,
        address.town,
        address.city,
        address.county,
        address.state,
        address.country,
      ]);
      if (parts.length > 0) label = parts[0]!;
    }
  }

  const shouldShowCoords =
    coordsMode === "always" || (coordsMode === "auto" && isCoarse);
  const coordsLine = shouldShowCoords ? formatCoords(coords, coordsPrecision) : null;

  return {
    label,
    coordsLine,
    isCoarse,
  };
}
