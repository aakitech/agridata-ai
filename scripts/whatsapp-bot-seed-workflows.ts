import { eq } from "drizzle-orm";
import { db } from "../src/server/db/index.ts";
import { organizations } from "../src/server/db/schema.ts";
import { type WorkflowConfig } from "../src/server/modules/whatsapp-bot/workflow-types.ts";

async function seedWorkflows() {
  console.log("Seeding legacy workflow configurations...");
  console.log("ZSAES uses scripts/seed-zsaes-pest-configs.ts and is not seeded here.");

  const mpbcConfig: WorkflowConfig = {
    id: "mpbc_trap",
    name: "MPBC - Trap Monitoring",
    steps: [
      {
        id: "pest_name",
        question:
          "Hello {{OfficerName}}\n\nThis is the MPBC Trap Monitoring system.\nWe'll record your latest African Armyworm trap observation.\n\nLet's begin.\n\nWhich pest are you observing?",
        type: "text",
        listOptions: [{ id: "African Armyworm", title: "African Armyworm" }],
      },
      {
        id: "count",
        question:
          "How many pests were caught in the trap?\n\nPlease enter a number only.\nExample: 3",
        type: "number",
        validation: { min: 0 },
      },
      {
        id: "photo",
        question:
          "Optional:\nYou may upload a photo of what was caught in the trap.\n\nOr reply SKIP to continue.",
        type: "photo",
        optional: true,
      },
      {
        id: "location",
        question:
          "Please share your GPS location for this trap.\n\nHow to share:\n1. Tap the attachment button\n2. Select 'Location'\n3. Send your current location",
        type: "location",
      },
    ],
  };

  try {
    const mpbcSlug = "mpbc";

    const existingMpbc = await db.query.organizations.findFirst({
      where: eq(organizations.slug, mpbcSlug),
    });

    if (existingMpbc) {
      await db
        .update(organizations)
        .set({ activeWorkflow: mpbcConfig.id, workflowConfig: mpbcConfig })
        .where(eq(organizations.slug, mpbcSlug));
      console.log("Updated MPBC workflow by slug mpbc.");
    } else {
      await db.insert(organizations).values({
        name: "MPBC",
        slug: mpbcSlug,
        activeWorkflow: mpbcConfig.id,
        workflowConfig: mpbcConfig,
      });
      console.log("Created MPBC with legacy workflow.");
    }

    const orgsUsingMpbc = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.activeWorkflow, mpbcConfig.id));

    for (const org of orgsUsingMpbc) {
      if (org.slug !== mpbcSlug) {
        await db
          .update(organizations)
          .set({ workflowConfig: mpbcConfig })
          .where(eq(organizations.id, org.id));
        console.log(`Updated workflow for org "${org.name}" (slug: ${org.slug}).`);
      }
    }

    console.log("Seeding complete.");
  } catch (err) {
    console.error("Seeding failed:", err);
  }

  process.exit(0);
}

seedWorkflows();
