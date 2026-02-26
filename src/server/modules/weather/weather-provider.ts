export type DailyWeatherSnapshot = {
  rainDayMm: number | null;
  rain7dMm: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  tempMeanC: number | null;
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
    const baseUrl = "https://archive-api.open-meteo.com/v1/archive";

    const search = new URLSearchParams({
      latitude: String(params.lat),
      longitude: String(params.lon),
      start_date: startDate,
      end_date: endDate,
      timezone: params.timezone,
      daily: "precipitation_sum,temperature_2m_min,temperature_2m_max",
    });

    const response = await fetch(`${baseUrl}?${search.toString()}`);
    if (!response.ok) {
      throw new Error(`PROVIDER_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as {
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
      providerVersion:
        typeof payload.generationtime_ms === "number"
          ? `generationtime_ms:${payload.generationtime_ms}`
          : null,
      rawPayload: payload,
    };
  }
}
