import { db } from "~/server/db";
import { botSessions, reports } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { 
  type WorkflowConfig, 
  type WorkflowStep, 
  type SessionData 
} from "./workflow-types";
import { MediaService } from "~/server/modules/media/media-service";

export class WorkflowProcessor {
  private config: WorkflowConfig;
  private userId: string;
  private orgId: string;
  private officerName: string;

  constructor(config: WorkflowConfig, userId: string, orgId: string, officerName: string) {
    this.config = config;
    this.userId = userId;
    this.orgId = orgId;
    this.officerName = officerName;
  }

  private formatMessage(text: string): string {
    return text.replace(/{{OfficerName}}/g, this.officerName);
  }

  async processMessage(session: any, msg: any): Promise<{ message: string; done: boolean }> {
    const data = (session.dataCollected as SessionData) || {};
    const currentStepId = session.currentStep;
    
    // 1. Initial Start
    if (!currentStepId) {
      const firstStep = this.config.steps[0]!;
      await this.updateSession(firstStep.id, data);
      return { message: this.formatMessage(firstStep.question), done: false };
    }

    // 2. Process Current Step Input
    const currentStep = this.config.steps.find(s => s.id === currentStepId);
    if (!currentStep) throw new Error(`Unknown step: ${currentStepId}`);

    const validation = await this.validateInput(currentStep, msg, data);
    if (!validation.valid) {
      return { message: `❌ ${validation.error}\n\n${currentStep.question}`, done: false };
    }

    // 3. Save Input
    data[currentStep.id] = validation.value;
    
    // 4. Determine Next Step
    const nextStepIndex = this.config.steps.findIndex(s => s.id === currentStepId) + 1;
    const nextStep = this.config.steps[nextStepIndex];

    if (nextStep) {
      await this.updateSession(nextStep.id, data);
      return { message: nextStep.question, done: false };
    } else {
      // 5. Workflow Complete
      const finalReport = await this.completeWorkflow(data);
      if (!finalReport) throw new Error("Failed to save final report");
      return { 
        message: `✅ **Report Saved!**\n\nThank you for your submission. (Report ID: ${finalReport.id.slice(0,8)})`, 
        done: true 
      };
    }
  }

  private async validateInput(step: WorkflowStep, msg: any, existingData: SessionData): Promise<{ valid: boolean; value?: any; error?: string }> {
    const text = msg.Body?.trim();

    if (step.optional) {
       const upper = text?.toUpperCase();
       if (upper === 'SKIP' || upper === 'NEXT') {
         return { valid: true, value: null };
       }
    }

    switch (step.type) {
      case 'number':
        const num = parseFloat(text);
        if (isNaN(num)) return { valid: false, error: "Please enter a valid number." };
        if (step.validation?.min !== undefined && num < step.validation.min) {
            return { valid: false, error: `Value cannot be less than ${step.validation.min}.` };
        }
        if (step.validation?.max_field_ref) {
            const maxVal = existingData[step.validation.max_field_ref];
            if (maxVal !== undefined && num > maxVal) {
                return { valid: false, error: `Value cannot be greater than ${step.validation.max_field_ref} (${maxVal}).` };
            }
        }
        return { valid: true, value: num };

      case 'location':
        if (msg.Latitude && msg.Longitude) {
          return { valid: true, value: `POINT(${msg.Longitude} ${msg.Latitude})` };
        }
        return { valid: false, error: "Please share your location (📎 -> Location)." };

      case 'photo':
        if (msg.MediaUrl0) {
          const mediaService = new MediaService();
          const contentType = msg.MediaContentType0 || "image/jpeg";
          try {
            // We use a temporary ID or just the userId for the path since report isn't created yet
            const uploadedUrl = await mediaService.uploadFromTwilio(msg.MediaUrl0, `temp_${this.userId}`, contentType);
            return { valid: true, value: uploadedUrl };
          } catch (e) {
            console.error("Upload failed", e);
            return { valid: true, value: msg.MediaUrl0 }; // Fallback
          }
        }
        return { valid: false, error: "Please send a photo." };

      default:
        if (!text && !step.optional) return { valid: false, error: "Input required." };
        return { valid: true, value: text };
    }
  }

  private async updateSession(stepId: string, data: SessionData) {
    await db.update(botSessions)
      .set({
        currentStep: stepId,
        dataCollected: data,
        lastActive: new Date(),
      })
      .where(eq(botSessions.userId, this.userId));
  }

  private async completeWorkflow(data: SessionData) {
    // 1. Compute Derived Fields
    const computedData: SessionData = { ...data };
    if (this.config.computations) {
      for (const comp of this.config.computations) {
        if (comp.formula === 'infestation_percentage') {
          const infested = data['stalks_infested'];
          const sampled = data['stalks_sampled'] || 100;
          if (typeof infested === 'number' && typeof sampled === 'number' && sampled > 0) {
            computedData[comp.outputField] = (infested / sampled) * 100;
          }
        }
      }
    }

    // 2. Persist Report
    const [report] = await db.insert(reports)
      .values({
        userId: this.userId,
        orgId: this.orgId,
        workflowId: this.config.id,
        dataPayload: computedData,
        status: 'PENDING_TRIAGE',
        // Extract common fields for indexing if they exist in data
        location: data['location'] || null,
        label: data['label'] || data['pest_name'] || null,
        mediaUrl: data['photo'] || data['photos'] || null,
      })
      .returning();

    // 3. Reset Session
    await db.update(botSessions)
      .set({
        currentStep: null,
        dataCollected: null,
        status: 'COMPLETED',
        workflowId: null,
        currentState: 'IDLE'
      })
      .where(eq(botSessions.userId, this.userId));

    return report;
  }
}
