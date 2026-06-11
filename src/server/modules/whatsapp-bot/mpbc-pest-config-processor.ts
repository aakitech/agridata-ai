import { and, eq } from "drizzle-orm";
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
const KUTSAGA_PEST_KEYS = new Set([
  "aphids",
  "mealybug",
  "budworm",
  "falsewire_worm",
]);
const KUTSAGA_ORG_SLUG = "kutsaga";

type DiseaseField = {
  key: string;
  prompt: string;
  options: string[];
};

const KUTSAGA_DISEASE_FIELDS: DiseaseField[] = [
  {
    key: "affected_part",
    prompt: "Which part of the tobacco plant looks affected?",
    options: ["Leaves", "Stem", "Roots", "Whole plant", "Seedbed", "Not sure"],
  },
  {
    key: "visible_symptoms",
    prompt: "What do you see on the plant?",
    options: [
      "Yellowing",
      "Wilting",
      "Spots or lesions",
      "Mould or fungal growth",
      "Rotting",
      "Stunted growth",
      "Leaves curling",
      "Other / not sure",
    ],
  },
  {
    key: "spread",
    prompt: "How many plants seem affected?",
    options: [
      "One/few plants",
      "Several plants",
      "Many plants",
      "Most of the field",
      "Not sure",
    ],
  },
  {
    key: "first_noticed",
    prompt: "When did you first notice this problem?",
    options: [
      "Today",
      "Last few days",
      "About a week ago",
      "More than a week ago",
      "Not sure",
    ],
  },
  {
    key: "recent_treatment",
    prompt: "Has the crop been sprayed or treated recently?",
    options: [
      "Recently sprayed or treated",
      "No recent treatment",
      "Not sure",
    ],
  },
];

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
    private officerName: string,
    private organizationName = "AgriData Technologies",
    private organizationSlug?: string
  ) {}

  async processMessage(
    session: typeof botSessions.$inferSelect,
    msg: IncomingMessage
  ): Promise<{ message: string; done: boolean; currentStep?: WorkflowStep }> {
    const data = (session.dataCollected as SessionData) || {};
    const currentStepId = session.currentStep;

    if (currentStepId === "submitting_report") {
      return {
        message:
          "We already received your final report details and are saving the report. Please wait for the confirmation before sending another message.",
        done: false,
      };
    }

    if (!currentStepId) {
      const step = this.isKutsagaDiseaseFlowEnabled()
        ? this.buildReportTypeSelectionStep()
        : await this.buildPestSelectionStep();
      await this.updateSession(step.id, data);
      return {
        message: this.formatMessage(step.question),
        done: false,
        currentStep: step,
      };
    }

    if (currentStepId === "report_type_selection") {
      const selection = this.parseListSelection(msg.Body, 3);
      if (!selection.valid) {
        const step = this.buildReportTypeSelectionStep();
        return { message: `❌ ${selection.error}`, done: false, currentStep: step };
      }

      if (selection.index === 1) {
        data.report_type = "PEST";
        const step = await this.buildPestSelectionStep();
        await this.updateSession(step.id, data);
        return { message: step.question, done: false, currentStep: step };
      }

      data.report_type = "DISEASE";
      data.report_type_label =
        selection.index === 2 ? "Disease/Symptom" : "Other / Not sure";
      data.crop = "Tobacco";

      const step = this.toDiseaseFieldStep(KUTSAGA_DISEASE_FIELDS[0]!);
      await this.updateSession(step.id, data);
      return { message: step.question, done: false, currentStep: step };
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
      const nextStep = this.buildNextFieldOrSharedStep(
        context.observationConfig,
        field.key,
        data
      );
      await this.updateSession(nextStep.id, data);
      return { message: nextStep.question, done: false, currentStep: nextStep };
    }

    if (currentStepId.startsWith("disease_field:")) {
      const fieldKey = currentStepId.replace("disease_field:", "");
      const field = KUTSAGA_DISEASE_FIELDS.find((item) => item.key === fieldKey);
      if (!field) {
        throw new Error(`Unknown disease field step ${fieldKey}`);
      }

      const validation = this.validateDiseaseFieldInput(field, msg);
      if (!validation.valid) {
        return {
          message: `❌ ${validation.error}`,
          done: false,
          currentStep: this.toDiseaseFieldStep(field),
        };
      }

      data[field.key] = validation.value;
      const nextStep = this.buildNextDiseaseStep(field.key);
      await this.updateSession(nextStep.id, data);
      return { message: nextStep.question, done: false, currentStep: nextStep };
    }

    if (currentStepId === "photo") {
      const validation = await this.validatePhotoInput(msg);
      if (!validation.valid) {
        return {
          message: `❌ ${validation.error}`,
          done: false,
          currentStep: this.buildPhotoStep(data),
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
      const claimed = await this.claimLocationSubmission(data);
      if (!claimed) {
        return {
          message:
            "We already received this location and are saving the report. Please wait for the confirmation before sending another message.",
          done: false,
        };
      }

      const finalReport = await this.completeReport(data);
      if (!finalReport) {
        throw new Error("Failed to save report");
      }
      return {
        message: this.getConfirmationMessage(finalReport),
        done: true,
      };
    }

    throw new Error(`Unsupported pest configuration session step: ${currentStepId}`);
  }

  private formatMessage(text: string): string {
    return text
      .replace(/{{OfficerName}}/g, this.officerName)
      .replace(/{{OrganizationName}}/g, this.organizationName);
  }

  private isKutsagaDiseaseFlowEnabled() {
    return this.organizationSlug === KUTSAGA_ORG_SLUG;
  }

  private buildReportTypeSelectionStep(): WorkflowStep {
    return {
      id: "report_type_selection",
      type: "list",
      question:
        "Hello {{OfficerName}}\n\nThis is the {{OrganizationName}} reporting system.\nWhat did you see?",
      listOptions: [
        { id: "pest", title: "Insects or pests" },
        { id: "disease", title: "Plant damage or symptoms" },
        { id: "other", title: "Other / not sure" },
      ],
    };
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
        "Hello {{OfficerName}}\n\nThis is the {{OrganizationName}} reporting system.\nPlease select the pest you are reporting:",
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
    data: SessionData
  ): WorkflowStep {
    const firstField = [...observationConfig.fields]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .find((field) => this.isFieldVisible(field, data));

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
    currentFieldKey: string,
    data: SessionData
  ): WorkflowStep {
    const orderedFields = [...observationConfig.fields].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
    const currentIndex = orderedFields.findIndex((item) => item.key === currentFieldKey);
    const nextField = orderedFields
      .slice(currentIndex + 1)
      .find((field) => this.isFieldVisible(field, data));

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

  private buildPhotoStep(data?: SessionData): WorkflowStep {
    if (data?.report_type === "DISEASE") {
      return {
        id: "photo",
        type: "photo",
        optional: true,
        question:
          "Optional: please send a clear photo if you can.\n\nHelpful photos:\n1. The whole affected plant\n2. A close-up of the affected leaf, stem, or root\n3. A wider field or seedbed view\n\nReply SKIP to continue without a photo.",
      };
    }

    return {
      id: "photo",
      type: "photo",
      optional: true,
      question:
        "Optional: please upload a photo of the observation, or reply SKIP to continue.",
    };
  }

  private toDiseaseFieldStep(field: DiseaseField): WorkflowStep {
    return {
      id: `disease_field:${field.key}`,
      type: "list",
      question: field.prompt,
      listOptions: field.options.map((option) => ({ id: option, title: option })),
    };
  }

  private validateDiseaseFieldInput(field: DiseaseField, msg: IncomingMessage) {
    const selection = this.parseListSelection(msg.Body, field.options.length);
    if (!selection.valid) {
      return { valid: false, error: selection.error };
    }

    return { valid: true, value: field.options[selection.index! - 1] };
  }

  private buildNextDiseaseStep(currentFieldKey: string): WorkflowStep {
    const currentIndex = KUTSAGA_DISEASE_FIELDS.findIndex(
      (field) => field.key === currentFieldKey
    );
    const nextField = KUTSAGA_DISEASE_FIELDS[currentIndex + 1];
    if (nextField) {
      return this.toDiseaseFieldStep(nextField);
    }

    return this.buildPhotoStep({ report_type: "DISEASE" });
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
    if (data.report_type === "DISEASE") {
      return this.completeDiseaseReport(data);
    }

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
        workflowId: "multi_pest_config",
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
      throw new Error("Failed to insert report");
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

  private async completeDiseaseReport(data: SessionData) {
    const severity = this.getDiseaseSeverity(data.spread);
    const alertTriggered = severity === "HIGH";
    const normalizedPayload = {
      raw: this.stripSystemKeys(data),
      derived: {
        severityBasis: "spread",
      },
      context: {},
      meta: {
        reportType: "DISEASE",
        reportTypeLabel: "Disease/Symptom",
        crop: "Tobacco",
        reviewModel: "OFFICER_REVIEW",
      },
    };

    const [report] = await db
      .insert(reports)
      .values({
        userId: this.userId,
        orgId: this.orgId,
        workflowId: "multi_pest_config",
        pestConfigurationId: null,
        pestKey: "disease_symptom",
        observationMethod: "FIELD_OBSERVATION",
        label: "Disease/Symptom",
        dataPayload: normalizedPayload,
        status: "PENDING_TRIAGE",
        category: "DISEASE",
        location: typeof data.location === "string" ? data.location : null,
        mediaUrl:
          typeof data.photo === "string"
            ? data.photo
            : typeof data.photos === "string"
              ? data.photos
              : null,
        observedCount: null,
        severity,
        severitySource: "SELF_REPORT",
        alertTriggered,
        alertTriggerReason: alertTriggered ? "disease_spread_high" : null,
      })
      .returning();

    if (!report) {
      throw new Error("Failed to insert disease report");
    }

    if (report.location && env.WEATHER_ENRICHMENT_ENABLED) {
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
        console.error("Failed to enqueue weather enrichment for disease report:", report.id, error);
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

  private getDiseaseSeverity(spread: unknown) {
    if (spread === "Many plants" || spread === "Most of the field") {
      return "HIGH" as const;
    }

    if (spread === "Several plants") {
      return "WARNING" as const;
    }

    return "NORMAL" as const;
  }

  private async claimLocationSubmission(data: SessionData) {
    const [session] = await db
      .update(botSessions)
      .set({
        currentStep: "submitting_report",
        dataCollected: data,
        workflowId: "multi_pest_config",
        lastActive: new Date(),
      })
      .where(
        and(
          eq(botSessions.userId, this.userId),
          eq(botSessions.currentStep, "location")
        )
      )
      .returning({ userId: botSessions.userId });

    return Boolean(session);
  }

  private getConfirmationMessage(report: typeof reports.$inferSelect) {
    if (report.category === "DISEASE") {
      return this.getDiseaseConfirmationMessage(report);
    }

    const pestName = report.label ?? "pest";
    const count = report.observedCount ?? "?";
    const isTrapFlow = report.observationMethod === "PHEROMONE_TRAP";
    const baseInfo = isTrapFlow
      ? `${pestName} count: ${count}`
      : this.buildObservationSummary(report) ?? `${pestName} observation recorded.`;

    if (report.pestKey === "locusts") {
      return `⚠️ POTENTIAL RISK\n\n${baseInfo}\n\nAlert thresholds are not yet configured.\nThis assessment is based on general guidance.`;
    }

    if (report.pestKey === "quelea_birds") {
      switch (report.severity) {
        case "HIGH":
          return `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🔴\n\nThis indicates a high-risk Quelea bird event.\nPlease notify your supervisor and protect nearby vulnerable crops immediately.`;
        case "WARNING":
          return `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nThis indicates elevated Quelea bird risk.\nPlease continue close monitoring and prepare to protect vulnerable crops.`;
        default:
          return `✅ Report received.\n\n${baseInfo}\nStatus: Low risk 🟢\n\nNo immediate action needed.\nContinue routine monitoring.`;
      }
    }

    if (report.pestKey === "rodents") {
      switch (report.severity) {
        case "HIGH":
          return `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🔴\n\nThis indicates high rodent activity.\nPlease notify your supervisor and strengthen control measures in the affected area.`;
        case "WARNING":
          return `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nThis indicates elevated rodent activity.\nPlease continue close monitoring and prepare follow-up control measures.`;
        default:
          return `✅ Report received.\n\n${baseInfo}\nStatus: Low risk 🟢\n\nNo immediate action needed.\nContinue routine monitoring.`;
      }
    }

    if (report.pestKey === "fall_armyworm") {
      switch (report.severity) {
        case "HIGH":
          return `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🔴\n\nThis exceeds the Fall Armyworm outbreak threshold.\nPlease notify your supervisor and begin field scouting in surrounding areas.`;
        case "WARNING":
          return `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nPlease monitor traps closely and watch for increasing Fall Armyworm activity.`;
        default:
          return `✅ Report received.\n\n${baseInfo}\nStatus: Low risk 🟢\n\nNo immediate action needed.\nContinue routine monitoring.`;
      }
    }

    if (report.pestKey === "fall_armyworm") {
      switch (report.severity) {
        case "HIGH":
          return `ðŸš¨ HIGH ALERT\n\n${baseInfo}\nStatus: High risk ðŸ”´\n\nThis exceeds the Fall Armyworm outbreak threshold.\nPlease notify your supervisor and begin field scouting in surrounding areas.`;
        case "WARNING":
          return `âš ï¸ Report received.\n\n${baseInfo}\nStatus: Warning ðŸŸ \n\nPlease monitor traps closely and watch for increasing Fall Armyworm activity.`;
        default:
          return `âœ… Report received.\n\n${baseInfo}\nStatus: Low risk ðŸŸ¢\n\nNo immediate action needed.\nContinue routine monitoring.`;
      }
    }

    if (report.pestKey === "fall_armyworm") {
      const raw = this.getRawPayload(report);
      const lines = ["Fall Armyworm observation recorded"];

      const adultInsectCount = this.asReadableValue(raw.adult_insect_count);
      if (adultInsectCount) {
        lines.push(`Adult insects caught: ${adultInsectCount}`);
      }

      return lines.join("\n");
    }

    if (report.pestKey === "whiteflies") {
      switch (report.severity) {
        case "HIGH":
          return `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🔴\n\nThis indicates severe whitefly infestation pressure.\nPlease notify your supervisor and assess immediate crop protection action.`;
        case "WARNING":
          return `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nThis indicates elevated whitefly infestation pressure.\nPlease continue close monitoring and watch for rapid spread.`;
        default:
          return `✅ Report received.\n\n${baseInfo}\nStatus: Low risk 🟢\n\nNo immediate action needed.\nContinue routine monitoring.`;
      }
    }

    if (report.severitySource === "DEFAULT_FALLBACK" || report.pestKey === "locusts") {
      switch (report.severity) {
        case "HIGH":
          return `🚨 POTENTIAL HIGH RISK\n\n${baseInfo}\n\nAlert thresholds are not yet configured.\nThis assessment is based on general guidance.`;
        case "WARNING":
          return `⚠️ POTENTIAL RISK\n\n${baseInfo}\n\nAlert thresholds are not yet configured.\nThis assessment is based on general guidance.`;
        default:
          return `✅ Report received.\n\n${baseInfo}\nStatus: Recorded\n\nThank you for your submission.`;
      }
    }

    if (KUTSAGA_PEST_KEYS.has(report.pestKey ?? "")) {
      switch (report.severity) {
        case "HIGH":
          return `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🚨\n\nThis exceeds the ${pestName} outbreak threshold.\nPlease notify your supervisor and begin field scouting in surrounding areas.`;
        case "WARNING":
          return `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nThis indicates elevated ${pestName} infestation pressure.\nPlease continue close monitoring and watch for rapid spread.`;
        default:
          return `✅ Report received.\n\n${baseInfo}\nStatus: Low risk 🟢\n\nNo immediate action needed.\nContinue routine monitoring.`;
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

  private getDiseaseConfirmationMessage(report: typeof reports.$inferSelect) {
    if (report.severity === "HIGH") {
      return "⚠️ Report received.\n\nYour disease/symptom report has been sent to Kutsaga for urgent review because many plants appear to be affected.\n\nA Kutsaga officer may follow up if more information is needed.";
    }

    return "✅ Report received.\n\nYour disease/symptom report has been sent to Kutsaga for review.\n\nA Kutsaga officer may follow up if more information is needed.";
  }

  private buildObservationSummary(report: typeof reports.$inferSelect) {
    if (report.category === "DISEASE") {
      return this.buildDiseaseObservationSummary(report);
    }

    if (KUTSAGA_PEST_KEYS.has(report.pestKey ?? "")) {
      return this.buildKutsagaObservationSummary(report);
    }

    if (report.pestKey === "locusts") {
      const raw = this.getRawPayload(report);
      const lines = ["Locust observation recorded"];

      const eventScale = this.asReadableValue(raw.event_scale);
      if (eventScale) {
        lines.push(`Estimated size: ${eventScale}`);
      }

      const movementDirection = this.asReadableValue(raw.movement_direction);
      if (movementDirection) {
        lines.push(`Direction: ${movementDirection}`);
      }

      const behavior = this.asReadableValue(raw.behavior);
      if (behavior) {
        lines.push(`Activity: ${behavior}`);
      }

      const cropVegetationType =
        raw.crop_vegetation_type === "Other"
          ? this.asReadableValue(raw.crop_vegetation_type_other)
          : this.asReadableValue(raw.crop_vegetation_type);
      if (cropVegetationType) {
        lines.push(`Crop / vegetation: ${cropVegetationType}`);
      }

      return lines.join("\n");
    }

    if (report.pestKey === "quelea_birds") {
      const raw = this.getRawPayload(report);
      const lines = ["Quelea bird observation recorded"];

      const flockSizeBand = this.asReadableValue(raw.flock_size_band);
      if (flockSizeBand) {
        lines.push(`Estimated flock size: ${flockSizeBand}`);
      }

      const behavior = this.asReadableValue(raw.behavior);
      if (behavior) {
        lines.push(`Activity: ${behavior}`);
      }

      const cropVegetationType =
        raw.crop_vegetation_type === "Other"
          ? this.asReadableValue(raw.crop_vegetation_type_other)
          : this.asReadableValue(raw.crop_vegetation_type);
      if (cropVegetationType) {
        lines.push(`Crop / vegetation: ${cropVegetationType}`);
      }

      const cropStage = this.asReadableValue(raw.crop_stage);
      if (cropStage) {
        lines.push(`Crop stage: ${cropStage}`);
      }

      return lines.join("\n");
    }

    if (report.pestKey === "rodents") {
      const raw = this.getRawPayload(report);
      const lines = ["Rodent observation recorded"];

      const activityLevel = this.asReadableValue(raw.activity_level);
      if (activityLevel) {
        lines.push(`Activity level: ${activityLevel}`);
      }

      const trend = this.asReadableValue(raw.trend);
      if (trend) {
        lines.push(`Trend: ${trend}`);
      }

      const damageType =
        raw.damage_type === "Other"
          ? this.asReadableValue(raw.damage_type_other)
          : this.asReadableValue(raw.damage_type);
      if (damageType) {
        lines.push(`Sign observed: ${damageType}`);
      }

      return lines.join("\n");
    }

    if (report.pestKey === "whiteflies") {
      const raw = this.getRawPayload(report);
      const lines = ["Whitefly observation recorded"];

      const plantsAffected = this.asReadableValue(raw.plants_affected);
      if (plantsAffected) {
        lines.push(`Plants affected: ${plantsAffected}`);
      }

      const plantsSampled = this.asReadableValue(raw.plants_sampled);
      if (plantsSampled) {
        lines.push(`Plants sampled: ${plantsSampled}`);
      }

      const cropType = this.asReadableValue(raw.crop_type);
      if (cropType) {
        lines.push(`Crop type: ${cropType}`);
      }

      return lines.join("\n");
    }

    return this.buildGenericObservationSummary(report);
  }

  private buildKutsagaObservationSummary(report: typeof reports.$inferSelect) {
    const raw = this.getRawPayload(report);
    const pestName = report.label ?? "Pest";

    switch (report.pestKey) {
      case "aphids":
        return `${pestName} count: ${String(raw.aphid_rating ?? "Not recorded")}`;
      case "mealybug":
        return `${pestName} count: ${String(raw.mealybug_rating ?? "Not recorded")}`;
      case "budworm":
        return `${pestName} damage: ${String(raw.budworm_damage_rating ?? "Not recorded")}`;
      case "falsewire_worm":
        return `${pestName} damage: ${String(raw.stem_damage_rating ?? "Not recorded")}`;
      default:
        return `${pestName} observation recorded`;
    }
  }

  private buildDiseaseObservationSummary(report: typeof reports.$inferSelect) {
    const raw = this.getRawPayload(report);
    const symptoms = this.asReadableValue(raw.visible_symptoms) ?? "Not recorded";
    const affectedPart = this.asReadableValue(raw.affected_part);
    const spread = this.asReadableValue(raw.spread);
    const lines = [`Disease/Symptom: ${symptoms}`];

    if (affectedPart) {
      lines.push(`Affected part: ${affectedPart}`);
    }
    if (spread) {
      lines.push(`Spread: ${spread}`);
    }

    return lines.join("\n");
  }

  private buildGenericObservationSummary(report: typeof reports.$inferSelect) {
    const raw = this.getRawPayload(report);
    const lines = [`${report.label ?? "Pest"} observation recorded`];
    const ignoredKeys = new Set([
      "location",
      "photo",
      "photos",
      "pest_key",
      "pest_name",
      "observation_method",
    ]);

    for (const [key, value] of Object.entries(raw)) {
      if (ignoredKeys.has(key) || key.startsWith("__")) continue;
      if (value === null || value === undefined || value === "") continue;
      if (typeof value === "object") continue;

      lines.push(`${this.formatFieldLabel(key)}: ${String(value)}`);
      if (lines.length >= 4) break;
    }

    return lines.join("\n");
  }

  private getRawPayload(report: typeof reports.$inferSelect) {
    const payload =
      report.dataPayload && typeof report.dataPayload === "object"
        ? (report.dataPayload as {
            raw?: Record<string, unknown>;
          })
        : null;

    return payload?.raw ?? {};
  }

  private asReadableValue(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    return value
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private formatFieldLabel(key: string) {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private isFieldVisible(
    field: ActiveObservationConfig["fields"][number],
    data: SessionData
  ) {
    const rules =
      field.validationRules && typeof field.validationRules === "object"
        ? (field.validationRules as {
            showWhenField?: string;
            showWhenEquals?: string;
          })
        : null;

    if (!rules?.showWhenField) {
      return true;
    }

    const currentValue = data[rules.showWhenField];
    if (rules.showWhenEquals !== undefined) {
      return currentValue === rules.showWhenEquals;
    }

    return currentValue !== null && currentValue !== undefined && currentValue !== "";
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
        workflowId: "multi_pest_config",
        lastActive: new Date(),
      })
      .where(eq(botSessions.userId, this.userId));
  }
}
