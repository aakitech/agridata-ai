import { eq, inArray, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { reportWeather } from "~/server/db/schema";
import { env } from "~/env";
import {
  OpenMeteoWeatherProvider,
  type DailyWeatherSnapshot,
  type WeatherProvider,
} from "./weather-provider";

const LEASE_MINUTES = 2;

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isValidCoordinate(lat: number | null, lon: number | null): boolean {
  if (lat == null || lon == null) return false;
  if (lat === 0 && lon === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

function getErrorCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 120);
  }
  return "WEATHER_ENRICHMENT_ERROR";
}

function computeBackoffMinutes(attemptCount: number): number {
  const base = env.WEATHER_ENRICHMENT_BASE_BACKOFF_MINUTES;
  return base * 2 ** Math.max(0, attemptCount - 1);
}

function buildProvider(): WeatherProvider {
  switch (env.WEATHER_PROVIDER) {
    case "open-meteo":
    default:
      return new OpenMeteoWeatherProvider();
  }
}

type QueueRow = {
  id: string;
  reportId: string;
  gridKey: string | null;
  observedLocalDate: string;
  timezone: string;
  lat: string | null;
  lon: string | null;
  attemptCount: number;
};

export class WeatherEnrichmentService {
  private provider: WeatherProvider;

  constructor(private database = db) {
    this.provider = buildProvider();
  }

  async leasePendingBatch(limit = env.WEATHER_ENRICHMENT_BATCH_SIZE): Promise<string[]> {
    const ids = await this.database.transaction(async (tx) => {
      const rows = (await tx.execute(sql`
        SELECT id
        FROM agridata_report_weather
        WHERE status = 'PENDING'::weather_enrichment_status
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY observed_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `)) as Array<{ id: string }>;

      const rowIds = rows.map((r) => r.id);
      if (rowIds.length === 0) return [];

      const leaseUntil = new Date(Date.now() + LEASE_MINUTES * 60 * 1000);
      await tx
        .update(reportWeather)
        .set({ nextRetryAt: leaseUntil })
        .where(inArray(reportWeather.id, rowIds));

      return rowIds;
    });

    return ids;
  }

  async processPendingBatch(limit = env.WEATHER_ENRICHMENT_BATCH_SIZE) {
    const leasedIds = await this.leasePendingBatch(limit);
    if (leasedIds.length === 0) {
      return { leased: 0, processed: 0, ok: 0, needsReview: 0, failed: 0, retried: 0 };
    }

    const rows = await this.database.query.reportWeather.findMany({
      where: inArray(reportWeather.id, leasedIds),
      orderBy: (table, { asc }) => [asc(table.observedAt)],
    });

    let ok = 0;
    let needsReview = 0;
    let failed = 0;
    let retried = 0;

    for (const row of rows as QueueRow[]) {
      const result = await this.enrichRow(row);
      if (result === "OK") ok += 1;
      if (result === "NEEDS_REVIEW") needsReview += 1;
      if (result === "FAILED") failed += 1;
      if (result === "RETRIED") retried += 1;
    }

    return {
      leased: leasedIds.length,
      processed: rows.length,
      ok,
      needsReview,
      failed,
      retried,
    };
  }

  private async enrichRow(row: QueueRow): Promise<"OK" | "NEEDS_REVIEW" | "FAILED" | "RETRIED"> {
    const lat = toNumberOrNull(row.lat);
    const lon = toNumberOrNull(row.lon);

    if (!isValidCoordinate(lat, lon)) {
      await this.database
        .update(reportWeather)
        .set({
          status: "NEEDS_REVIEW",
          qualityFlag: "SUSPECT",
          errorCode: "INVALID_COORDINATES",
          lastErrorAt: new Date(),
          nextRetryAt: null,
        })
        .where(eq(reportWeather.id, row.id));
      return "NEEDS_REVIEW";
    }
    const latNum = lat as number;
    const lonNum = lon as number;

    try {
      const gridKey = row.gridKey;
      const cached = gridKey
        ? await this.database.query.reportWeather.findFirst({
            where: (table, { and, eq, ne }) =>
              and(
                eq(table.gridKey, gridKey),
                eq(table.observedLocalDate, row.observedLocalDate),
                eq(table.status, "OK"),
                ne(table.reportId, row.reportId)
              ),
            orderBy: (table, { desc }) => [desc(table.fetchedAt), desc(table.updatedAt)],
          })
        : null;

      const weather =
        cached != null
          ? {
              rainDayMm: toNumberOrNull(cached.rainDayMm),
              rain7dMm: toNumberOrNull(cached.rain7dMm),
              tempMinC: toNumberOrNull(cached.tempMinC),
              tempMaxC: toNumberOrNull(cached.tempMaxC),
              tempMeanC: toNumberOrNull(cached.tempMeanC),
              providerVersion: cached.providerVersion,
              rawPayload: null,
            }
          : await this.provider.fetchDailySnapshot({
              lat: latNum,
              lon: lonNum,
              observedLocalDate: row.observedLocalDate,
              timezone: row.timezone || env.WEATHER_DEFAULT_TIMEZONE,
            });

      const quality = this.validateWeatherHeuristics({
        lat: latNum,
        lon: lonNum,
        weather,
      });

      const status = quality.flag === "SUSPECT" ? "NEEDS_REVIEW" : "OK";

      await this.database
        .update(reportWeather)
        .set({
          status,
          qualityFlag: quality.flag,
          errorCode: quality.errorCode,
          source: cached?.source ?? this.provider.name,
          fetchedAt: new Date(),
          nextRetryAt: null,
          lastErrorAt: quality.flag === "SUSPECT" ? new Date() : null,
          rainDayMm: weather.rainDayMm != null ? weather.rainDayMm.toString() : null,
          rain7dMm: weather.rain7dMm != null ? weather.rain7dMm.toString() : null,
          tempMinC: weather.tempMinC != null ? weather.tempMinC.toString() : null,
          tempMaxC: weather.tempMaxC != null ? weather.tempMaxC.toString() : null,
          tempMeanC: weather.tempMeanC != null ? weather.tempMeanC.toString() : null,
          providerVersion: weather.providerVersion ?? null,
          providerPayload: weather.rawPayload ?? null,
          updatedAt: new Date(),
        })
        .where(eq(reportWeather.id, row.id));

      return status;
    } catch (error) {
      const nextAttemptCount = (row.attemptCount ?? 0) + 1;
      const terminal = nextAttemptCount >= env.WEATHER_ENRICHMENT_MAX_RETRIES;
      const nextRetryAt = terminal
        ? null
        : new Date(Date.now() + computeBackoffMinutes(nextAttemptCount) * 60 * 1000);
      await this.database
        .update(reportWeather)
        .set({
          attemptCount: nextAttemptCount,
          status: terminal ? "FAILED" : "PENDING",
          errorCode: getErrorCode(error),
          lastErrorAt: new Date(),
          nextRetryAt,
          updatedAt: new Date(),
        })
        .where(eq(reportWeather.id, row.id));

      return terminal ? "FAILED" : "RETRIED";
    }
  }

  private validateWeatherHeuristics(input: {
    lat: number;
    lon: number;
    weather: DailyWeatherSnapshot;
  }): { flag: "PLAUSIBLE" | "SUSPECT"; errorCode: string | null } {
    const { lat, lon, weather } = input;
    if (!isValidCoordinate(lat, lon)) {
      return { flag: "SUSPECT", errorCode: "INVALID_COORDINATES" };
    }

    const tempMean = weather.tempMeanC;
    const rainDay = weather.rainDayMm;
    const rain7d = weather.rain7dMm;
    if (tempMean != null && (tempMean < -5 || tempMean > 50)) {
      return { flag: "SUSPECT", errorCode: "TEMP_MEAN_OUT_OF_RANGE" };
    }
    if (rainDay != null && (rainDay < 0 || rainDay > 300)) {
      return { flag: "SUSPECT", errorCode: "RAIN_DAY_OUT_OF_RANGE" };
    }
    if (rain7d != null && (rain7d < 0 || rain7d > 1000)) {
      return { flag: "SUSPECT", errorCode: "RAIN_7D_OUT_OF_RANGE" };
    }
    if (
      weather.tempMinC == null ||
      weather.tempMaxC == null ||
      weather.tempMeanC == null ||
      weather.rainDayMm == null ||
      weather.rain7dMm == null
    ) {
      return { flag: "SUSPECT", errorCode: "MISSING_WEATHER_FIELDS" };
    }

    return { flag: "PLAUSIBLE", errorCode: null };
  }
}
