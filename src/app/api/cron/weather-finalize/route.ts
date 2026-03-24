import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { WeatherEnrichmentService } from "~/server/modules/weather/weather-service";

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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!env.WEATHER_ENRICHMENT_ENABLED) {
    return NextResponse.json({
      success: true,
      provider: env.WEATHER_PROVIDER,
      skipped_by_config: true,
      reason: "WEATHER_ENRICHMENT_ENABLED=false",
    });
  }

  const batchSizeParam = req.nextUrl.searchParams.get("batchSize");
  const batchSize =
    batchSizeParam != null
      ? Math.max(1, Math.min(200, Number.parseInt(batchSizeParam, 10) || env.WEATHER_ENRICHMENT_BATCH_SIZE))
      : env.WEATHER_ENRICHMENT_BATCH_SIZE;

  const service = new WeatherEnrichmentService();
  const summary = await service.processProvisionalBatch(batchSize);

  return NextResponse.json({
    success: true,
    provider: env.WEATHER_PROVIDER,
    batchSize,
    ...summary,
  });
}
