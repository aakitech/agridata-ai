export type WeatherStatus = "PENDING" | "OK" | "FAILED" | "NEEDS_REVIEW";
export type WeatherQualityFlag = "UNKNOWN" | "PLAUSIBLE" | "SUSPECT";

export type ReportWeatherUI = {
  status: WeatherStatus;
  qualityFlag: WeatherQualityFlag;
  source: string | null;
  observedLocalDate: string;
  fetchedAt: string | Date | null;
  rainDayMm: number | null;
  rain7dMm: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  tempMeanC: number | null;
  observedAt?: string | Date | null;
  isProvisional?: boolean;
  isMock?: boolean;
};

type RawWeatherLike = {
  status: WeatherStatus;
  qualityFlag?: WeatherQualityFlag | null;
  source?: string | null;
  observedLocalDate?: string | Date | null;
  fetchedAt?: string | Date | null;
  observedAt?: string | Date | null;
  rainDayMm?: string | number | null;
  rain7dMm?: string | number | null;
  tempMinC?: string | number | null;
  tempMaxC?: string | number | null;
  tempMeanC?: string | number | null;
  isProvisional?: boolean;
  isMock?: boolean;
} | null | undefined;

export function normalizeReportWeatherUI(weather: RawWeatherLike): ReportWeatherUI | null {
  if (!weather?.status) return null;

  const observedLocalDate =
    weather.observedLocalDate instanceof Date
      ? weather.observedLocalDate.toISOString().slice(0, 10)
      : typeof weather.observedLocalDate === "string"
        ? weather.observedLocalDate
        : "";

  return {
    status: weather.status,
    qualityFlag: weather.qualityFlag ?? "UNKNOWN",
    source: weather.source ?? null,
    observedLocalDate,
    fetchedAt: weather.fetchedAt ?? null,
    observedAt: weather.observedAt ?? null,
    rainDayMm: toNumberOrNull(weather.rainDayMm),
    rain7dMm: toNumberOrNull(weather.rain7dMm),
    tempMinC: toNumberOrNull(weather.tempMinC),
    tempMaxC: toNumberOrNull(weather.tempMaxC),
    tempMeanC: toNumberOrNull(weather.tempMeanC),
    isProvisional: weather.isProvisional === true,
    isMock: weather.isMock === true,
  };
}

export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function formatWeatherMetric(
  value: number | null | undefined,
  suffix: string,
  digits = 1
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(digits)}${suffix}`;
}

export function getWeatherStatusUI(status?: WeatherStatus | null) {
  switch (status) {
    case "OK":
      return {
        label: "Estimated",
        toneClass: "bg-blue-50 text-blue-700 ring-blue-700/10",
        dotClass: "bg-blue-500",
      };
    case "PENDING":
      return {
        label: "Pending",
        toneClass: "bg-muted text-muted-foreground ring-border",
        dotClass: "bg-gray-400",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Review",
        toneClass: "bg-amber-50 text-amber-700 ring-amber-700/10",
        dotClass: "bg-amber-500",
      };
    case "FAILED":
    default:
      return {
        label: "Unavailable",
        toneClass: "bg-red-50 text-red-700 ring-red-700/10",
        dotClass: "bg-red-500",
      };
  }
}

export function formatIsoLocalDate(dateLike: Date | string | null | undefined): string {
  if (!dateLike) return "N/A";
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toISOString().slice(0, 10);
}
