import { db } from "../src/server/db/index.ts";
import { organizations } from "../src/server/db/schema.ts";
import { eq } from "drizzle-orm";
import { type WorkflowConfig } from "../src/server/modules/whatsapp-bot/workflow-types.ts";

async function seedWorkflows() {
  console.log("Seeding workflow configurations...");

  const zsaesConfig: WorkflowConfig = {
    id: "zsaes_scouting",
    name: "ZSAES - Field Scouting",
    steps: [
      { id: "sector_name", question: "Welcome to ZSAES Scouting. 🌿\n\nWhat is the **Sector Name**?", type: "text" },
      { id: "farm_size_ha", question: "What is the **Farm Size** (in hectares)?", type: "number", validation: { min: 0 } },
      { id: "stalks_sampled", question: "How many **stalks were sampled**? (Typical: 100)", type: "number", defaultValue: 100, validation: { min: 1 } },
      { id: "stalks_infested", question: "How many **stalks were infested**?", type: "number", validation: { min: 0, max_field_ref: "stalks_sampled" } },
      { id: "pests_observed", question: "Which **pests** were observed? (e.g., Fall Armyworm)", type: "text" },
      { id: "diseases_observed", question: "Any **diseases** observed? (Type 'SKIP' if none)", type: "text", optional: true },
      { id: "photo", question: "Please upload a **photo** of the observation.", type: "photo", optional: true },
      { id: "location", question: "Final step: Please share your **GPS Location**. 📍", type: "location" }
    ],
    computations: [
      { outputField: "infestation_percentage", formula: "infestation_percentage" }
    ]
  };

  const mpbcConfig: WorkflowConfig = {
    id: "mpbc_trap",
    name: "MPBC - Trap Monitoring",
    steps: [
      { 
        id: "pest_name", 
        question: "👋 Hello {{OfficerName}}\n\nThis is the MPBC Trap Monitoring system.\nWe'll record your latest Fall Armyworm trap observation.\n\nLet's begin.\n\n🐛 Which pest are you observing?\n\nFor this season, this is usually:\n• Fall Armyworm\n\nYou may type the pest name or reply:\n1️⃣ Fall Armyworm", 
        type: "text" 
      },
      { 
        id: "count", 
        question: "🔢 How many insects were caught in the trap?\n\nPlease enter a number only.\nExample: 3", 
        type: "number", 
        validation: { min: 0 } 
      },
      { 
        id: "photo", 
        question: "📸 Optional:\nYou may upload a photo of what was caught in the trap.\n\nOr reply SKIP to continue.", 
        type: "photo", 
        optional: true
      },
      { 
        id: "location", 
        question: "📍 Please share your GPS location for this trap.\n\n💡 How to share:\n1. Tap the 📎 (attachment) button\n2. Select 'Location'\n3. Send your current location", 
        type: "location" 
      }
    ]
  };

  try {
    // We assume these orgs exist or we create/update based on name/slug
    // Finding by slug is safest
    const zsaesSlug = "zsaes";
    const mpbcSlug = "mpbc";

    // Update or Insert ZSAES
    const existingZsaes = await db.query.organizations.findFirst({ where: eq(organizations.slug, zsaesSlug) });
    if (existingZsaes) {
      await db.update(organizations)
        .set({ activeWorkflow: zsaesConfig.id, workflowConfig: zsaesConfig })
        .where(eq(organizations.slug, zsaesSlug));
      console.log("✅ Updated ZSAES workflow.");
    } else {
      await db.insert(organizations).values({
        name: "ZSAES",
        slug: zsaesSlug,
        activeWorkflow: zsaesConfig.id,
        workflowConfig: zsaesConfig
      });
      console.log("✅ Created ZSAES with workflow.");
    }

    // Update or Insert MPBC
    const existingMpbc = await db.query.organizations.findFirst({ where: eq(organizations.slug, mpbcSlug) });
    if (existingMpbc) {
      await db.update(organizations)
        .set({ activeWorkflow: mpbcConfig.id, workflowConfig: mpbcConfig })
        .where(eq(organizations.slug, mpbcSlug));
      console.log("✅ Updated MPBC workflow.");
    } else {
      await db.insert(organizations).values({
        name: "MPBC",
        slug: mpbcSlug,
        activeWorkflow: mpbcConfig.id,
        workflowConfig: mpbcConfig
      });
      console.log("✅ Created MPBC with workflow.");
    }

    console.log("🚀 Seeding complete!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  }
  process.exit(0);
}

seedWorkflows();
