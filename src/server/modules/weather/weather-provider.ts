export type DailyWeatherSnapshot = {
  rainDayMm: number | null;
  rain7dMm: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  tempMeanC: number | null;
  isProvisional: boolean;
  providerVersion?: string | null;
  rawPayload?: unknown;
};

export interface WeatherProvider {
  readonly name: string;
  fetchDailySnapshot(params: {
    lat: number;
    lon: number;
    observedLocalDate: string;
    timezone: string;
  }): Promise<DailyWeatherSnapshot>;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) throw new Error(`Invalid date string: ${dateStr}`);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getLocalDateString(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) throw new Error(`Invalid local date for timezone ${timezone}`);
  return `${year}-${month}-${day}`;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 15_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`PROVIDER_HTTP_${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("PROVIDER_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly name = "open-meteo";

  async fetchDailySnapshot(params: {
    lat: number;
    lon: number;
    observedLocalDate: string;
    timezone: string;
  }): Promise<DailyWeatherSnapshot> {
    const startDate = shiftDate(params.observedLocalDate, -6);
    const endDate = params.observedLocalDate;
    const todayLocalDate = getLocalDateString(new Date(), params.timezone);
    const useProvisionalFeed = params.observedLocalDate >= todayLocalDate;

    const baseUrl = useProvisionalFeed
      ? "https://api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive";

    const search = useProvisionalFeed
      ? new URLSearchParams({
          latitude: String(params.lat),
          longitude: String(params.lon),
          timezone: params.timezone,
          daily: "precipitation_sum,temperature_2m_min,temperature_2m_max",
          past_days: "7",
          forecast_days: "1",
        })
      : new URLSearchParams({
          latitude: String(params.lat),
          longitude: String(params.lon),
          start_date: startDate,
          end_date: endDate,
          timezone: params.timezone,
          daily: "precipitation_sum,temperature_2m_min,temperature_2m_max",
        });

    const payload = (await fetchJsonWithTimeout(
      `${baseUrl}?${search.toString()}`
    )) as {
      daily?: {
        time?: string[];
        precipitation_sum?: Array<number | string | null>;
        temperature_2m_min?: Array<number | string | null>;
        temperature_2m_max?: Array<number | string | null>;
      };
      generationtime_ms?: number;
    };

    const days = payload.daily?.time ?? [];
    const rain = payload.daily?.precipitation_sum ?? [];
    const tempMin = payload.daily?.temperature_2m_min ?? [];
    const tempMax = payload.daily?.temperature_2m_max ?? [];

    if (days.length === 0) {
      throw new Error("PROVIDER_EMPTY_DAILY");
    }

    const targetIndex = days.findIndex((d) => d === params.observedLocalDate);
    if (targetIndex < 0) {
      throw new Error("PROVIDER_MISSING_TARGET_DAY");
    }

    const rainDayMm = toNumberOrNull(rain[targetIndex]);
    const tempMinC = toNumberOrNull(tempMin[targetIndex]);
    const tempMaxC = toNumberOrNull(tempMax[targetIndex]);
    const tempMeanC =
      tempMinC != null && tempMaxC != null
        ? Number(((tempMinC + tempMaxC) / 2).toFixed(2))
        : null;

    const rain7dMmRaw = rain.reduce<number>(
      (sum, value) => sum + (toNumberOrNull(value) ?? 0),
      0
    );
    const rain7dMm = Number(rain7dMmRaw.toFixed(3));

    return {
      rainDayMm,
      rain7dMm,
      tempMinC,
      tempMaxC,
      tempMeanC,
      isProvisional: useProvisionalFeed,
      providerVersion:
        typeof payload.generationtime_ms === "number"
          ? `generationtime_ms:${payload.generationtime_ms}`
          : null,
      rawPayload: payload,
    };
  }
}
