import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import {
  botSessions,
  pestConfigurations,
  reports,
  reportWeather,
} from "~/server/db/schema";
import type { WorkflowStep, SessionData } from "./workflow-types";
import { MediaService } from "~/server/modules/media/media-service";
import { AlertsService } from "~/server/modules/alerts/alerts-service";
import { parseLocation } from "~/lib/geo";
import { env } from "~/env";
import {
  computeGridKey,
  toObservedLocalDate,
} from "~/server/modules/weather/weather-utils";
import { WeatherEnrichmentService } from "~/server/modules/weather/weather-service";

const DEFAULT_WEATHER_TIMEZONE =
  env.WEATHER_DEFAULT_TIMEZONE || "Africa/Johannesburg";
const INLINE_WEATHER_TIMEOUT_MS = Math.max(
  0,
  env.WEATHER_INLINE_ENRICHMENT_TIMEOUT_MS
);

type IncomingMessage = {
  From: string;
  Body?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  Latitude?: string;
  Longitude?: string;
};

type ActivePest = Awaited<
  ReturnType<MpbcPestConfigProcessor["getActivePests"]>
>[number];

type ActiveObservationConfig = ActivePest["observationConfigs"][number];

export class MpbcPestConfigProcessor {
  constructor(
    private userId: string,
    private orgId: string,
    private officerName: string
  ) {}

  async processMessage(
    session: typeof botSessions.$inferSelect,
    msg: IncomingMessage
  ): Promise<{ message: string; done: boolean; currentStep?: WorkflowStep }> {
    const data = (session.dataCollected as SessionData) || {};
    const currentStepId = session.currentStep;

    if (!currentStepId) {
      const step = await this.buildPestSelectionStep();
      await this.updateSession(step.id, data);
      return {
        message: this.formatMessage(step.question),
        done: false,
        currentStep: step,
      };
    }

    if (currentStepId === "pest_selection") {
      const pests = await this.getActivePests();
      const selection = this.parseListSelection(msg.Body, pests.length);
      if (!selection.valid) {
        const step = await this.buildPestSelectionStep();
        return { message: `❌ ${selection.error}`, done: false, currentStep: step };
      }

      const selectedPest = pests[selection.index! - 1]!;
      data.__pestConfigId = selectedPest.id;
      data.pest_key = selectedPest.key;
      data.pest_name = selectedPest.label;

      const activeMethods = selectedPest.observationConfigs
        .filter((config) => config.active)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      if (activeMethods.length > 1) {
        const step = this.buildMethodSelectionStep(selectedPest);
        await this.updateSession(step.id, data);
        return { message: step.question, done: false, currentStep: step };
      }

      const selectedMethod = activeMethods[0];
      if (!selectedMethod) {
        throw new Error(`No active observation methods found for pest ${selectedPest.key}`);
      }

      data.__observationConfigId = selectedMethod.id;
      data.observation_method = selectedMethod.method;

      const nextStep = this.buildNextStepAfterMethod(selectedPest, selectedMethod, data);
      await this.updateSession(nextStep.id, data);
      return { message: nextStep.question, done: false, currentStep: nextStep };
    }

    if (currentStepId === "method_selection") {
      const context = await this.loadSelectedContext(data);
      if (!context) {
        const step = await this.buildPestSelectionStep();
        await this.updateSession(step.id, {});
        return {
          message: "❌ Your session lost the selected pest. Let's start again.\n\n" + step.question,
          done: false,
          currentStep: step,
        };
      }

      const selection = this.parseListSelection(
        msg.Body,
        context.pest.observationConfigs.filter((item) => item.active).length
      );
      if (!selection.valid) {
        const step = this.buildMethodSelectionStep(context.pest);
        return { message: `❌ ${selection.error}`, done: false, currentStep: step };
      }

      const selectedMethod = context.pest.observationConfigs
        .filter((item) => item.active)
        .sort((a, b) => a.displayOrder - b.displayOrder)[selection.index! - 1]!;

      data.__observationConfigId = selectedMethod.id;
      data.observation_method = selectedMethod.method;

      const nextStep = this.buildNextStepAfterMethod(context.pest, selectedMethod, data);
      await this.updateSession(nextStep.id, data);
      return { message: nextStep.question, done: false, currentStep: nextStep };
    }

    if (currentStepId.startsWith("field:")) {
      const context = await this.loadSelectedContext(data);
      if (!context || !context.observationConfig) {
        const step = await this.buildPestSelectionStep();
        await this.updateSession(step.id, {});
        return {
          message: "❌ Your session lost the selected pest. Let's start again.\n\n" + step.question,
          done: false,
          currentStep: step,
        };
      }

      const fieldKey = currentStepId.replace("field:", "");
      const field = context.observationConfig.fields.find((item) => item.key === fieldKey);
      if (!field) {
        throw new Error(`Unknown field step ${fieldKey}`);
      }

      const validation = await this.validateFieldInput(field, msg, data);
      if (!validation.valid) {
        return {
          message: `❌ ${validation.error}`,
          done: false,
          currentStep: this.toWorkflowFieldStep(field),
        };
      }

      data[field.key] = validation.value;
      const nextStep = this.buildNextFieldOrSharedStep(context.observationConfig, field.key);
      await this.updateSession(nextStep.id, data);
      return { message: nextStep.question, done: false, currentStep: nextStep };
    }

    if (currentStepId === "photo") {
      const validation = await this.validatePhotoInput(msg);
      if (!validation.valid) {
        return {
          message: `❌ ${validation.error}`,
          done: false,
          currentStep: this.buildPhotoStep(),
        };
      }

      data.photo = validation.value;
      const step = this.buildLocationStep(data);
      await this.updateSession(step.id, data);
      return { message: step.question, done: false, currentStep: step };
    }

    if (currentStepId === "location") {
      const validation = this.validateLocationInput(msg);
      if (!validation.valid) {
        return {
          message: `❌ ${validation.error}`,
          done: false,
            currentStep: this.buildLocationStep(data),
          };
        }

      data.location = validation.value;
      const finalReport = await this.completeReport(data);
      if (!finalReport) {
        throw new Error("Failed to save MPBC report");
      }
      return {
        message: this.getConfirmationMessage(finalReport),
        done: true,
      };
    }

    throw new Error(`Unsupported MPBC session step: ${currentStepId}`);
  }

  private formatMessage(text: string): string {
    return text.replace(/{{OfficerName}}/g, this.officerName);
  }

  private async getActivePests() {
    return db.query.pestConfigurations.findMany({
      where: eq(pestConfigurations.orgId, this.orgId),
      with: {
        observationConfigs: {
          with: {
            fields: true,
            severityRules: true,
          },
        },
      },
      orderBy: (table, { asc }) => [asc(table.displayOrder)],
    });
  }

  private async buildPestSelectionStep(): Promise<WorkflowStep> {
    const pests = (await this.getActivePests()).filter((item) => item.active);
    return {
      id: "pest_selection",
      type: "list",
      question:
        "Hello {{OfficerName}}\n\nThis is the MPBC Pest Monitoring system.\nPlease select the pest you are reporting:",
      listOptions: pests.map((pest) => ({
        id: pest.key,
        title: pest.label,
      })),
    };
  }

  private buildMethodSelectionStep(pest: ActivePest): WorkflowStep {
    const options = pest.observationConfigs
      .filter((item) => item.active)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => ({
        id: item.method,
        title: this.formatObservationMethodLabel(item.method),
        description: item.guidanceText ?? undefined,
      }));

    return {
      id: "method_selection",
      type: "list",
      question: `How are you observing ${pest.label} today?`,
      listOptions: options,
    };
  }

  private buildNextStepAfterMethod(
    pest: ActivePest,
    observationConfig: ActiveObservationConfig,
    _data: SessionData
  ): WorkflowStep {
    const firstField = [...observationConfig.fields].sort(
      (a, b) => a.displayOrder - b.displayOrder
    )[0];

    if (firstField) {
      return this.toWorkflowFieldStep(firstField);
    }

    const photoStep = this.buildPhotoStep();
    return {
      ...photoStep,
      question:
        observationConfig.guidanceText
          ? `${observationConfig.guidanceText}\n\n${photoStep.question}`
          : `You selected ${pest.label}.\n\n${photoStep.question}`,
    };
  }

  private buildNextFieldOrSharedStep(
    observationConfig: ActiveObservationConfig,
    currentFieldKey: string
  ): WorkflowStep {
    const orderedFields = [...observationConfig.fields].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
    const currentIndex = orderedFields.findIndex((item) => item.key === currentFieldKey);
    const nextField = orderedFields[currentIndex + 1];

    if (nextField) {
      return this.toWorkflowFieldStep(nextField);
    }

    return this.buildPhotoStep();
  }

  private toWorkflowFieldStep(field: ActiveObservationConfig["fields"][number]): WorkflowStep {
    return {
      id: `field:${field.key}`,
      type: field.fieldType === "number" ? "number" : "text",
      question: field.prompt,
      optional: !field.required,
      listOptions:
        field.fieldType === "select" && Array.isArray(field.options)
          ? (field.options as string[]).map((option) => ({ id: option, title: option }))
          : undefined,
    };
  }

  private buildPhotoStep(): WorkflowStep {
    return {
      id: "photo",
      type: "photo",
      optional: true,
      question:
        "Optional: please upload a photo of the observation, or reply SKIP to continue.",
    };
  }

  private buildLocationStep(data?: SessionData): WorkflowStep {
    const isTrapFlow = data?.observation_method === "PHEROMONE_TRAP";
    return {
      id: "location",
      type: "location",
      question:
        isTrapFlow
          ? "📍 Please share your GPS location for this trap.\n\n💡 How to share:\n1. Tap the 📎 (attachment) button\n2. Select 'Location'\n3. Send your current location"
          : "📍 Please share your GPS location for this observation.\n\n💡 How to share:\n1. Tap the 📎 (attachment) button\n2. Select 'Location'\n3. Send your current location",
    };
  }

  private parseListSelection(body: string | undefined, length: number) {
    const trimmed = body?.trim() ?? "";
    const parsed = Number.parseInt(trimmed, 10);
    if (!trimmed || Number.isNaN(parsed)) {
      return { valid: false, error: "Please type the number of your choice." };
    }
    if (parsed < 1 || parsed > length) {
      return {
        valid: false,
        error: `Please type a number between 1 and ${length}.`,
      };
    }
    return { valid: true, index: parsed };
  }

  private async loadSelectedContext(data: SessionData) {
    const pestConfigId = data.__pestConfigId as string | undefined;
    const observationConfigId = data.__observationConfigId as string | undefined;
    if (!pestConfigId) return null;

    const pests = await this.getActivePests();
    const pest = pests.find((item) => item.id === pestConfigId);
    if (!pest) return null;

    const observationConfig = pest.observationConfigs.find(
      (item) => item.id === observationConfigId
    );

    return { pest, observationConfig: observationConfig ?? null };
  }

  private async validateFieldInput(
    field: ActiveObservationConfig["fields"][number],
    msg: IncomingMessage,
    existingData: SessionData
  ): Promise<{ valid: boolean; value?: unknown; error?: string }> {
    const text = msg.Body?.trim();

    if (!field.required) {
      const upper = text?.toUpperCase();
      if (upper === "SKIP" || upper === "NEXT") {
        return { valid: true, value: null };
      }
    }

    if (field.fieldType === "number") {
      const parsed = Number.parseFloat(text ?? "");
      if (Number.isNaN(parsed)) {
        return { valid: false, error: "Please enter a valid number." };
      }

      const rules = (field.validationRules ?? {}) as {
        min?: number;
        max?: number;
        maxFieldRef?: string;
      };
      if (typeof rules.min === "number" && parsed < rules.min) {
        return { valid: false, error: `Value cannot be less than ${rules.min}.` };
      }
      if (typeof rules.max === "number" && parsed > rules.max) {
        return { valid: false, error: `Value cannot be greater than ${rules.max}.` };
      }
      if (typeof rules.maxFieldRef === "string") {
        const maxValue = existingData[rules.maxFieldRef];
        if (typeof maxValue === "number" && parsed > maxValue) {
          return {
            valid: false,
            error: `Value cannot be greater than ${rules.maxFieldRef} (${maxValue}).`,
          };
        }
      }
      return { valid: true, value: parsed };
    }

    if (field.fieldType === "select") {
      const options = Array.isArray(field.options) ? (field.options as string[]) : [];
      const selection = this.parseListSelection(text, options.length);
      if (!selection.valid) {
        return { valid: false, error: selection.error };
      }
      return { valid: true, value: options[selection.index! - 1] };
    }

    if (field.fieldType === "boolean") {
      const normalized = (text ?? "").trim().toLowerCase();
      if (["yes", "y", "true", "1"].includes(normalized)) {
        return { valid: true, value: true };
      }
      if (["no", "n", "false", "0"].includes(normalized)) {
        return { valid: true, value: false };
      }
      return { valid: false, error: "Please reply yes or no." };
    }

    if (!text && field.required) {
      return { valid: false, error: "Input required." };
    }

    return { valid: true, value: text ?? null };
  }

  private async validatePhotoInput(msg: IncomingMessage) {
    const text = msg.Body?.trim();
    if (text?.toUpperCase() === "SKIP") {
      return { valid: true, value: null };
    }

    if (!msg.MediaUrl0) {
      return { valid: false, error: "Please send a photo or reply SKIP." };
    }

    const mediaService = new MediaService();
    const contentType = msg.MediaContentType0 || "image/jpeg";
    try {
      const uploadedUrl = await mediaService.uploadFromTwilio(
        msg.MediaUrl0,
        `temp_${this.userId}`,
        contentType
      );
      return { valid: true, value: uploadedUrl };
    } catch (error) {
      console.error("Upload failed", error);
      return { valid: true, value: msg.MediaUrl0 };
    }
  }

  private validateLocationInput(msg: IncomingMessage) {
    if (msg.Latitude && msg.Longitude) {
      return {
        valid: true,
        value: `POINT(${msg.Longitude} ${msg.Latitude})`,
      };
    }
    return {
      valid: false,
      error: "Please share your location using WhatsApp's location option.",
    };
  }

  private async completeReport(data: SessionData) {
    const alertsService = new AlertsService(db, this.orgId, "org_admin");
    const pestKey = String(data.pest_key ?? data.pest_name ?? "");
    const assessment = await alertsService.computePestAssessment({
      orgId: this.orgId,
      pestKey,
      observationMethod: data.observation_method,
      raw: data,
    });

    const normalizedPayload = {
      raw: this.stripSystemKeys(data),
      derived: assessment.derived,
      context: {},
      meta: {
        pestKey: assessment.pestKey,
        pestLabel: assessment.pestLabel,
        observationMethod: assessment.observationMethod,
      },
    };

    const [report] = await db
      .insert(reports)
      .values({
        userId: this.userId,
        orgId: this.orgId,
        workflowId: "mpbc_multi_pest",
        pestConfigurationId: assessment.pestConfigurationId,
        pestKey: assessment.pestKey,
        observationMethod: assessment.observationMethod,
        label: assessment.pestLabel,
        dataPayload: normalizedPayload,
        status: "PENDING_TRIAGE",
        category: "PEST",
        location: typeof data.location === "string" ? data.location : null,
        mediaUrl:
          typeof data.photo === "string"
            ? data.photo
            : typeof data.photos === "string"
              ? data.photos
              : null,
        observedCount: assessment.observedCount,
        severity: assessment.severity,
        severitySource: assessment.source,
        alertTriggered: assessment.alertTriggered,
        alertTriggerReason: assessment.alertTriggerReason,
      })
      .returning();

    if (!report) {
      throw new Error("Failed to insert MPBC report");
    }

    if (report?.location && env.WEATHER_ENRICHMENT_ENABLED) {
      try {
        const coords = parseLocation(report.location);
        if (coords) {
          const observedLocalDate = toObservedLocalDate(
            report.createdAt,
            DEFAULT_WEATHER_TIMEZONE
          );
          await db.insert(reportWeather).values({
            reportId: report.id,
            orgId: report.orgId,
            lat: coords.lat.toFixed(6),
            lon: coords.lon.toFixed(6),
            observedAt: report.createdAt,
            observedLocalDate,
            timezone: DEFAULT_WEATHER_TIMEZONE,
            gridKey: computeGridKey(coords.lat, coords.lon, observedLocalDate),
            source: env.WEATHER_PROVIDER,
            status: "PENDING",
          });

          if (
            env.WEATHER_INLINE_ENRICHMENT_ENABLED &&
            INLINE_WEATHER_TIMEOUT_MS > 0
          ) {
            const weatherService = new WeatherEnrichmentService(db);
            const inlineEnrichment = weatherService
              .enrichReportWeather(report.id)
              .catch(() => "FAILED" as const);

            await Promise.race([
              inlineEnrichment,
              new Promise<"TIMEOUT">((resolve) =>
                setTimeout(() => resolve("TIMEOUT"), INLINE_WEATHER_TIMEOUT_MS)
              ),
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to enqueue weather enrichment for report:", report.id, error);
      }
    }

    await db
      .update(botSessions)
      .set({
        currentStep: null,
        dataCollected: null,
        workflowId: null,
        status: "COMPLETED",
        lastActive: new Date(),
      })
      .where(eq(botSessions.userId, this.userId));

    return report;
  }

  private getConfirmationMessage(report: typeof reports.$inferSelect) {
    const pestName = report.label ?? "pest";
    const count = report.observedCount ?? "?";
    const isTrapFlow = report.observationMethod === "PHEROMONE_TRAP";
    const baseInfo = isTrapFlow
      ? `${pestName} count: ${count}`
      : `${pestName} observation: ${count}`;

    if (report.severitySource === "DEFAULT_FALLBACK") {
      switch (report.severity) {
        case "HIGH":
          return `🚨 POTENTIAL HIGH RISK\n\n${baseInfo}\n\nAlert thresholds are not yet configured.\nThis assessment is based on general guidance.`;
        case "WARNING":
          return `⚠️ POTENTIAL RISK\n\n${baseInfo}\n\nAlert thresholds are not yet configured.\nThis assessment is based on general guidance.`;
        default:
          return `✅ Report received.\n\n${baseInfo}\nStatus: Recorded\n\nThank you for your submission.`;
      }
    }

    switch (report.severity) {
      case "HIGH":
        return isTrapFlow
          ? `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🔴\n\nThis exceeds the outbreak threshold.\nPlease notify your supervisor and begin field scouting in surrounding areas.`
          : `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🔴\n\nPlease notify your supervisor and monitor closely.`;
      case "WARNING":
        return isTrapFlow
          ? `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nPlease monitor traps closely and watch for increasing activity.`
          : `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nPlease continue close monitoring.`;
      default:
        return isTrapFlow
          ? `✅ Report received.\n\n${baseInfo}\nStatus: Low risk 🟢\n\nNo immediate action needed.\nContinue routine monitoring.`
          : `✅ Report received.\n\n${baseInfo}\nStatus: Recorded\n\nThank you for your submission.`;
    }
  }

  private stripSystemKeys(data: SessionData) {
    return Object.fromEntries(
      Object.entries(data).filter(([key]) => !key.startsWith("__"))
    );
  }

  private formatObservationMethodLabel(
    method: "PHEROMONE_TRAP" | "FIELD_OBSERVATION" | "EVENT_OBSERVATION" | "SIGN_BASED"
  ) {
    switch (method) {
      case "PHEROMONE_TRAP":
        return "Pheromone trap";
      case "FIELD_OBSERVATION":
        return "Field observation";
      case "EVENT_OBSERVATION":
        return "Event observation";
      case "SIGN_BASED":
        return "Sign-based observation";
      default:
        return method;
    }
  }

  private async updateSession(stepId: string, data: SessionData) {
    await db
      .update(botSessions)
      .set({
        currentStep: stepId,
        dataCollected: data,
        workflowId: "mpbc_multi_pest",
        lastActive: new Date(),
      })
      .where(eq(botSessions.userId, this.userId));
  }
}
