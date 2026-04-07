import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  appUsers,
  botSessions,
  organizations,
  pestConfigurations,
  reports,
  reportWeather,
} from "~/server/db/schema";
import { WorkflowProcessor } from "~/server/modules/whatsapp-bot/workflow-processor";
import { type WorkflowConfig } from "~/server/modules/whatsapp-bot/workflow-types";
import { MpbcPestConfigProcessor } from "~/server/modules/whatsapp-bot/mpbc-pest-config-processor";

type SimRequest = {
  from: string;
  body?: string;
  latitude?: string | number;
  longitude?: string | number;
  mediaUrl0?: string;
  mediaContentType0?: string;
  reset?: boolean;
};

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith("whatsapp:")
    ? trimmed.replace("whatsapp:", "").trim()
    : trimmed;
}

export async function POST(req: NextRequest) {
  if (env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "whatsapp-simulate is only available in development" },
      { status: 403 }
    );
  }

  let payload: SimRequest;
  try {
    payload = (await req.json()) as SimRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload?.from || payload.from.trim().length < 5) {
    return NextResponse.json({ error: "from is required" }, { status: 400 });
  }

  const phoneNumber = normalizePhone(payload.from);
  const senderId = `whatsapp:${phoneNumber}`;

  let user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phoneNumber),
    with: { organization: true },
  });

  if (!user) {
    const result = await db.execute(sql`
      SELECT id FROM agridata_app_users
      WHERE TRIM(phone_number) = ${phoneNumber}
      LIMIT 1
    `);
    if (result.length > 0 && result[0]?.id) {
      user = await db.query.appUsers.findFirst({
        where: eq(appUsers.id, result[0].id as string),
        with: { organization: true },
      });
    }
  }

  if (!user) {
    return NextResponse.json(
      { error: `User not found for phone ${phoneNumber}` },
      { status: 404 }
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: `User ${user.id} is not active` },
      { status: 400 }
    );
  }

  const org = user.organization;
  if (!org) {
    return NextResponse.json(
      { error: `User ${user.id} has no organization` },
      { status: 400 }
    );
  }

  const hasActivePestConfigs = await db.query.pestConfigurations.findFirst({
    where: and(
      eq(pestConfigurations.orgId, org.id),
      eq(pestConfigurations.active, true)
    ),
  });

  if (!hasActivePestConfigs && (!org.activeWorkflow || !org.workflowConfig)) {
    return NextResponse.json(
      { error: `Organization ${org.id} has no active workflow` },
      { status: 400 }
    );
  }

  if (payload.reset) {
    await db
      .update(botSessions)
      .set({
        currentStep: null,
        dataCollected: null,
        status: "RESET",
        workflowId: null,
        currentState: "IDLE",
        lastActive: new Date(),
      })
      .where(eq(botSessions.userId, user.id));
  }

  let session = await db.query.botSessions.findFirst({
    where: eq(botSessions.userId, user.id),
  });

  if (!session) {
    const [created] = await db
      .insert(botSessions)
      .values({ userId: user.id, status: "ACTIVE", currentState: "IDLE" })
      .returning();
    session = created;
  }

  if (!session) {
    return NextResponse.json({ error: "Failed to initialize session" }, { status: 500 });
  }

  const processor = hasActivePestConfigs
    ? new MpbcPestConfigProcessor(user.id, org.id, user.fullName || phoneNumber)
    : new WorkflowProcessor(
        org.workflowConfig as WorkflowConfig,
        user.id,
        org.id,
        user.fullName || phoneNumber
      );

  const incomingMsg = {
    From: senderId,
    Body: payload.body,
    MediaUrl0: payload.mediaUrl0,
    MediaContentType0: payload.mediaContentType0,
    Latitude:
      payload.latitude != null && `${payload.latitude}`.length > 0
        ? `${payload.latitude}`
        : undefined,
    Longitude:
      payload.longitude != null && `${payload.longitude}`.length > 0
        ? `${payload.longitude}`
        : undefined,
  };

  let result:
    | Awaited<ReturnType<WorkflowProcessor["processMessage"]>>
    | null = null;
  try {
    result = await processor.processMessage(session, incomingMsg);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Processor execution failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }

  const refreshedSession = await db.query.botSessions.findFirst({
    where: eq(botSessions.userId, user.id),
  });

  const latestReport = await db.query.reports.findFirst({
    where: eq(reports.userId, user.id),
    orderBy: [desc(reports.createdAt)],
  });

  const latestWeather = latestReport
    ? await db.query.reportWeather.findFirst({
        where: eq(reportWeather.reportId, latestReport.id),
      })
    : null;

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      phoneNumber,
      orgId: org.id,
    },
    incoming: incomingMsg,
    processorResult: result,
    session: refreshedSession
      ? {
          userId: refreshedSession.userId,
          status: refreshedSession.status,
          currentState: refreshedSession.currentState,
          currentStep: refreshedSession.currentStep,
          workflowId: refreshedSession.workflowId,
          lastActive: refreshedSession.lastActive,
        }
      : null,
    latestReport: latestReport
      ? {
          id: latestReport.id,
          createdAt: latestReport.createdAt,
          status: latestReport.status,
          workflowId: latestReport.workflowId,
          location: latestReport.location,
          label: latestReport.label,
        }
      : null,
    latestWeather: latestWeather
      ? {
          reportId: latestWeather.reportId,
          status: latestWeather.status,
          qualityFlag: latestWeather.qualityFlag,
          errorCode: latestWeather.errorCode,
          fetchedAt: latestWeather.fetchedAt,
          rainfallMm: latestWeather.rainDayMm,
          rainDayMm: latestWeather.rainDayMm,
          rain7dMm: latestWeather.rain7dMm,
          minTempC: latestWeather.tempMinC,
          maxTempC: latestWeather.tempMaxC,
          avgTempC: latestWeather.tempMeanC,
          tempMeanC: latestWeather.tempMeanC,
          relativeHumidityPct: latestWeather.relativeHumidityPct,
          isProvisional: latestWeather.isProvisional,
        }
      : null,
  });
}
