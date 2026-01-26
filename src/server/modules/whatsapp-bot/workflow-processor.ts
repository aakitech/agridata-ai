import { db } from "~/server/db";
import { botSessions, reports } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import {
  type WorkflowConfig,
  type WorkflowStep,
  type SessionData,
} from "./workflow-types";
import { MediaService } from "~/server/modules/media/media-service";
import { AlertsService } from "~/server/modules/alerts/alerts-service";

export class WorkflowProcessor {
  private config: WorkflowConfig;
  private userId: string;
  private orgId: string;
  private officerName: string;

  constructor(
    config: WorkflowConfig,
    userId: string,
    orgId: string,
    officerName: string
  ) {
    this.config = config;
    this.userId = userId;
    this.orgId = orgId;
    this.officerName = officerName;
  }

  private formatMessage(text: string): string {
    return text.replace(/{{OfficerName}}/g, this.officerName);
  }

  async processMessage(
    session: any,
    msg: any
  ): Promise<{ message: string; done: boolean; currentStep?: WorkflowStep }> {
    const data = (session.dataCollected as SessionData) || {};
    const currentStepId = session.currentStep;

    // 1. Initial Start
    if (!currentStepId) {
      const firstStep = this.config.steps[0]!;
      await this.updateSession(firstStep.id, data);
      return { 
        message: this.formatMessage(firstStep.question), 
        done: false,
        currentStep: firstStep
      };
    }

    // 2. Process Current Step Input
    const currentStep = this.config.steps.find((s) => s.id === currentStepId);
    if (!currentStep) throw new Error(`Unknown step: ${currentStepId}`);

    const validation = await this.validateInput(currentStep, msg, data);
    if (!validation.valid) {
      return {
        message: `❌ ${validation.error}`,
        done: false,
        currentStep,
      };
    }

    // 3. Save Input
    data[currentStep.id] = validation.value;

    // 4. Determine Next Step
    const nextStepIndex =
      this.config.steps.findIndex((s) => s.id === currentStepId) + 1;
    const nextStep = this.config.steps[nextStepIndex];

    if (nextStep) {
      await this.updateSession(nextStep.id, data);
      return { 
        message: nextStep.question, 
        done: false,
        currentStep: nextStep
      };
    } else {
      // 5. Workflow Complete
      const finalReport = await this.completeWorkflow(data);
      if (!finalReport) throw new Error("Failed to save final report");
      
      // Get severity-aware confirmation message
      const confirmationMessage = this.getSeverityConfirmation(
        finalReport,
        data,
        finalReport.severitySource
      );
      return {
        message: confirmationMessage,
        done: true,
      };
    }
  }

  private async validateInput(
    step: WorkflowStep,
    msg: any,
    existingData: SessionData
  ): Promise<{ valid: boolean; value?: any; error?: string }> {
    const text = msg.Body?.trim();

    if (step.optional) {
      const upper = text?.toUpperCase();
      if (upper === "SKIP" || upper === "NEXT") {
        return { valid: true, value: null };
      }
    }

    switch (step.type) {
      case "number":
        const num = parseFloat(text);
        if (isNaN(num))
          return { valid: false, error: "Please enter a valid number." };
        if (step.validation?.min !== undefined && num < step.validation.min) {
          return {
            valid: false,
            error: `Value cannot be less than ${step.validation.min}.`,
          };
        }
        if (step.validation?.max_field_ref) {
          const maxVal = existingData[step.validation.max_field_ref];
          if (maxVal !== undefined && num > maxVal) {
            return {
              valid: false,
              error: `Value cannot be greater than ${step.validation.max_field_ref} (${maxVal}).`,
            };
          }
        }
        return { valid: true, value: num };

      case "location":
        if (msg.Latitude && msg.Longitude) {
          return {
            valid: true,
            value: `POINT(${msg.Longitude} ${msg.Latitude})`,
          };
        }
        return {
          valid: false,
          error: "Please share your location (📎 -> Location).",
        };

      case "photo":
        if (msg.MediaUrl0) {
          const mediaService = new MediaService();
          const contentType = msg.MediaContentType0 || "image/jpeg";
          try {
            // We use a temporary ID or just the userId for the path since report isn't created yet
            const uploadedUrl = await mediaService.uploadFromTwilio(
              msg.MediaUrl0,
              `temp_${this.userId}`,
              contentType
            );
            return { valid: true, value: uploadedUrl };
          } catch (e) {
            console.error("Upload failed", e);
            return { valid: true, value: msg.MediaUrl0 }; // Fallback
          }
        }
        
        // Allow optional skip
        if (step.optional && text && text.toUpperCase() === "SKIP") {
          return { valid: true, value: null };
        }
        
        if (step.optional) {
          return { valid: false, error: "Please send a photo or reply SKIP." };
        }
        return { valid: false, error: "Please send a photo." };

      default:
        if (!text && !step.optional)
          return { valid: false, error: "Input required." };

        const trimmed = (text ?? "").trim();

        // When step has listOptions: numbers-only selection (1..N)
        if (step.listOptions && step.listOptions.length > 0) {
          const n = parseFloat(trimmed);
          const isNumeric = trimmed !== "" && !isNaN(n) && isFinite(n);
          if (isNumeric) {
            const idx = Math.floor(n);
            if (idx >= 1 && idx <= step.listOptions.length) {
              return { valid: true, value: step.listOptions[idx - 1]!.id };
            }
            const rangeMsg =
              step.listOptions.length > 1
                ? `Please type the number of your choice (1 to ${step.listOptions.length}).`
                : "Please type the number to select your pest (e.g. 1).";
            return { valid: false, error: rangeMsg };
          }
          return {
            valid: false,
            error: "Please type the number to select your pest (e.g. 1, 2, 3).",
          };
        }

        // Fallback for pest selection without listOptions: numbers-only, no typed names
        if ((step.id === "pest_name" || step.id === "pests_observed") && trimmed) {
          const n = parseFloat(trimmed);
          const isNumeric = trimmed !== "" && !isNaN(n) && isFinite(n);
          if (isNumeric) {
            const idx = Math.floor(n);
            if (idx >= 1 && idx <= 1) {
              return { valid: true, value: "African Armyworm" };
            }
          }
          return {
            valid: false,
            error: "Please type the number to select your pest (e.g. 1).",
          };
        }

        return { valid: true, value: trimmed };
    }
  }

  private async updateSession(stepId: string, data: SessionData) {
    await db
      .update(botSessions)
      .set({
        currentStep: stepId,
        dataCollected: data,
        lastActive: new Date(),
      })
      .where(eq(botSessions.userId, this.userId));
  }

  private getSeverityConfirmation(
    report: any,
    data: SessionData,
    severitySource: "ORG_CONFIG" | "DEFAULT_FALLBACK" | null
  ): string {
    const count = data["count"] ?? "?";
    const pestName = data["pest_name"] ?? "pest";
    const severity = report.severity;

    const baseInfo = `${pestName} count: ${count}`;

    // Use fallback messaging when severitySource is DEFAULT_FALLBACK
    if (severitySource === "DEFAULT_FALLBACK") {
      switch (severity) {
        case "WARNING":
          return `⚠️ POTENTIAL RISK\n\n${baseInfo}\n\nAlert thresholds are not yet configured.\nThis assessment is based on general guidance.`;
        
        case "HIGH":
          return `🚨 POTENTIAL HIGH RISK\n\n${baseInfo}\n\nAlert thresholds have not yet been configured for your organisation.\nBased on standard guidance, this count suggests elevated risk.\n\nPlease monitor closely and inform your supervisor.`;
        
        default:
          // Should not happen with fallback logic, but handle gracefully
          return `✅ Report received.\n\n${baseInfo}\nStatus: Recorded\n\nThank you for your submission.`;
      }
    }

    // Use existing messaging when org thresholds exist (ORG_CONFIG or null for backward compatibility)
    switch (severity) {
      case "NORMAL":
        return `✅ Report received.\n\n${baseInfo}\nStatus: Low risk 🟢\n\nNo immediate action needed.\nContinue routine monitoring.`;
      
      case "WARNING":
        return `⚠️ Report received.\n\n${baseInfo}\nStatus: Warning 🟠\n\nPlease monitor traps closely and watch for increasing activity.`;
      
      case "HIGH":
        return `🚨 HIGH ALERT\n\n${baseInfo}\nStatus: High risk 🔴\n\nThis exceeds the outbreak threshold.\nPlease notify your supervisor and begin field scouting in surrounding areas.`;
      
      default:
        return `✅ Report received.\n\n${baseInfo}\nStatus: Recorded\n\nThank you for your submission.`;
    }
  }

  private async completeWorkflow(data: SessionData) {
    // 1. Compute Derived Fields
    const computedData: SessionData = { ...data };
    if (this.config.computations) {
      for (const comp of this.config.computations) {
        if (comp.formula === "infestation_percentage") {
          const infested = data["stalks_infested"];
          const sampled = data["stalks_sampled"] || 100;
          if (
            typeof infested === "number" &&
            typeof sampled === "number" &&
            sampled > 0
          ) {
            computedData[comp.outputField] = (infested / sampled) * 100;
          }
        }
      }
    }

    // 2. Extract fields for severity computation
    const pestKey = data["pest_name"] || data["label"] || null;
    const observedCountRaw = data["count"] || data["quantity"] || null;
    // Normalize observedCount to integer if it's a number
    const observedCount =
      typeof observedCountRaw === "number"
        ? Math.floor(observedCountRaw)
        : typeof observedCountRaw === "string"
        ? parseInt(observedCountRaw, 10)
        : null;
    const isValidCount =
      observedCount !== null && !isNaN(observedCount) && observedCount >= 0;

    // 3. Compute severity using AlertsService
    let severity: "NORMAL" | "WARNING" | "HIGH" | null = null;
    let severitySource: "ORG_CONFIG" | "DEFAULT_FALLBACK" | null = null;
    if (pestKey && isValidCount) {
      try {
        const alertsService = new AlertsService(db, this.orgId, "org_admin");
        const result = await alertsService.computeSeverity(
          this.orgId,
          pestKey,
          observedCount
        );
        severity = result.severity;
        severitySource = result.source;
      } catch (error) {
        console.error("Error computing severity:", error);
        // Default to NORMAL on error with ORG_CONFIG source
        severity = "NORMAL";
        severitySource = "ORG_CONFIG";
      }
    } else {
      // No pestKey or count: default to NORMAL with ORG_CONFIG source
      severity = "NORMAL";
      severitySource = "ORG_CONFIG";
    }

    // 4. Persist Report
    const [report] = await db
      .insert(reports)
      .values({
        userId: this.userId,
        orgId: this.orgId,
        workflowId: this.config.id,
        dataPayload: computedData,
        status: "PENDING_TRIAGE",
        // Extract common fields for indexing if they exist in data
        location: data["location"] || null,
        label: pestKey,
        mediaUrl: data["photo"] || data["photos"] || null,
        // Severity system fields
        observedCount: isValidCount ? observedCount : null,
        severity: severity,
        severitySource: severitySource,
      })
      .returning();

    // 5. Reset Session
    await db
      .update(botSessions)
      .set({
        currentStep: null,
        dataCollected: null,
        status: "COMPLETED",
        workflowId: null,
        currentState: "IDLE",
      })
      .where(eq(botSessions.userId, this.userId));

    return report;
  }
}
