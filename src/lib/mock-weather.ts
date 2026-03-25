import type { ReportWeatherUI } from "~/lib/weather-ui";
import { formatIsoLocalDate } from "~/lib/weather-ui";

type MockPresetName = "OK_PLAUSIBLE" | "PENDING" | "NEEDS_REVIEW" | "FAILED";

type WeatherCarrier = {
  id: string;
  weather?: unknown;
  createdAt?: Date | string;
  date?: Date | string;
};

export const WEATHER_UI_MOCK_ENABLED =
  process.env.NEXT_PUBLIC_WEATHER_UI_MOCK === "true";

function getObservedLocalDate(item: WeatherCarrier) {
  return formatIsoLocalDate(item.createdAt ?? item.date ?? new Date());
}

function buildMockWeather(item: WeatherCarrier, preset: MockPresetName): ReportWeatherUI {
  const common = {
    source: "open-meteo (mock)",
    observedLocalDate: getObservedLocalDate(item),
    fetchedAt: new Date().toISOString(),
    isMock: true,
  } satisfies Partial<ReportWeatherUI>;

  if (preset === "OK_PLAUSIBLE") {
    return {
      status: "OK",
      qualityFlag: "PLAUSIBLE",
      rainfallMm: 8.4,
      rainDayMm: 8.4,
      rain7dMm: 31.2,
      minTempC: 16.2,
      tempMinC: 16.2,
      maxTempC: 28.1,
      tempMaxC: 28.1,
      avgTempC: 22.2,
      tempMeanC: 22.2,
      relativeHumidityPct: 68.4,
      ...common,
    } as ReportWeatherUI;
  }

  if (preset === "PENDING") {
    return {
      status: "PENDING",
      qualityFlag: "UNKNOWN",
      rainfallMm: null,
      rainDayMm: null,
      rain7dMm: null,
      minTempC: null,
      tempMinC: null,
      maxTempC: null,
      tempMaxC: null,
      avgTempC: null,
      tempMeanC: null,
      relativeHumidityPct: null,
      ...common,
    } as ReportWeatherUI;
  }

  if (preset === "NEEDS_REVIEW") {
    return {
      status: "NEEDS_REVIEW",
      qualityFlag: "SUSPECT",
      rainfallMm: 42.7,
      rainDayMm: 42.7,
      rain7dMm: 118.5,
      minTempC: 14.1,
      tempMinC: 14.1,
      maxTempC: 36.8,
      tempMaxC: 36.8,
      avgTempC: 25.5,
      tempMeanC: 25.5,
      relativeHumidityPct: 91.2,
      ...common,
    } as ReportWeatherUI;
  }

  return {
    status: "FAILED",
    qualityFlag: "UNKNOWN",
    rainfallMm: null,
    rainDayMm: null,
    rain7dMm: null,
    minTempC: null,
    tempMinC: null,
    maxTempC: null,
    tempMaxC: null,
    avgTempC: null,
    tempMeanC: null,
    relativeHumidityPct: null,
    ...common,
  } as ReportWeatherUI;
}

function hashSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickPreset(item: WeatherCarrier, seedIndex?: number): MockPresetName {
  const presets: MockPresetName[] = ["OK_PLAUSIBLE", "PENDING", "NEEDS_REVIEW", "FAILED"];
  const idx = seedIndex ?? (hashSeed(item.id) % presets.length);
  return presets[idx % presets.length]!;
}

export function withMockWeather<T extends WeatherCarrier>(item: T, seedIndex?: number): T {
  if (!WEATHER_UI_MOCK_ENABLED || item.weather) return item;
  return {
    ...item,
    weather: buildMockWeather(item, pickPreset(item, seedIndex)),
  };
}

export function withMockWeatherList<T extends WeatherCarrier>(items: T[] | undefined): T[] | undefined {
  return items?.map((item, index) => withMockWeather(item, index));
}

export function withMockWeatherLocations<
  T extends { latestReport: WeatherCarrier; reports: WeatherCarrier[] }
>(
  locations: T[] | undefined
): T[] | undefined {
  if (!locations) return locations;
  return locations.map((location, locationIndex) => ({
    ...location,
    latestReport: withMockWeather(location.latestReport, locationIndex),
    reports: location.reports.map((report, reportIndex) =>
      withMockWeather(report, locationIndex + reportIndex + 1)
    ),
  })) as T[];
}
