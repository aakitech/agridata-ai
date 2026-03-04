import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { env } from "~/env";
import { parseLocation } from "~/lib/geo";
import { db } from "~/server/db";
import { reportWeather } from "~/server/db/schema";
import { computeGridKey, toObservedLocalDate } from "~/server/modules/weather/weather-utils";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = env.WEATHER_ENRICHMENT_CRON_SECRET;
  if (!secret) return false;

  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === secret) return true;

  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return token === secret;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const timezone = env.WEATHER_DEFAULT_TIMEZONE;

  if (orgId && !UUID_REGEX.test(orgId)) {
    return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
  }
  if (from && Number.isNaN(Date.parse(from))) {
    return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
  }
  if (to && Number.isNaN(Date.parse(to))) {
    return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
  }

  const limit = Math.max(
    1,
    Math.min(1000, Number.parseInt(limitParam ?? "200", 10) || 200)
  );

  const result = (await db.execute(sql`
    SELECT
      r.id,
      r.org_id,
      r.location,
      r.created_at
    FROM agridata_reports r
    LEFT JOIN agridata_report_weather rw ON rw.report_id = r.id
    WHERE rw.report_id IS NULL
      AND r.location IS NOT NULL
      ${orgId ? sql`AND r.org_id = ${orgId}` : sql``}
      ${from ? sql`AND r.created_at >= ${new Date(from)}` : sql``}
      ${to ? sql`AND r.created_at <= ${new Date(to)}` : sql``}
    ORDER BY r.created_at ASC
    LIMIT ${limit}
  `)) as Array<{
    id: string;
    org_id: string | null;
    location: string | null;
    created_at: Date;
  }>;

  const values = result
    .map((row) => {
      const coords = parseLocation(row.location);
      if (!coords) return null;
      const observedLocalDate = toObservedLocalDate(row.created_at, timezone);
      return {
        reportId: row.id,
        orgId: row.org_id,
        lat: coords.lat.toFixed(6),
        lon: coords.lon.toFixed(6),
        observedAt: row.created_at,
        observedLocalDate,
        timezone,
        gridKey: computeGridKey(coords.lat, coords.lon, observedLocalDate),
        source: env.WEATHER_PROVIDER,
        status: "PENDING" as const,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  let insertedCount = 0;
  if (values.length > 0) {
    const inserted = await db
      .insert(reportWeather)
      .values(values)
      .onConflictDoNothing({ target: reportWeather.reportId })
      .returning({ reportId: reportWeather.reportId });
    insertedCount = inserted.length;
  }

  return NextResponse.json({
    success: true,
    scanned: result.length,
    candidateCount: values.length,
    enqueued: insertedCount,
    limit,
    orgId: orgId ?? null,
    from: from ?? null,
    to: to ?? null,
  });
}
