import { db } from "../src/server/db/index.ts";
import { appUsers, organizations } from "../src/server/db/schema.ts";
import { eq } from "drizzle-orm";

async function debugUser() {
  const phone = "+27794979611";
  console.log(`Checking for user with phone: ${phone}`);

  const user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phone),
    with: {
        organization: true
    }
  });

  if (!user) {
    console.log("❌ User not found!");
    
    // Check for potential format mismatch (e.g., without +)
    const phoneNoPlus = phone.replace('+', '');
    const userNoPlus = await db.query.appUsers.findFirst({
        where: eq(appUsers.phoneNumber, phoneNoPlus)
    });
    if (userNoPlus) {
        console.log(`⚠️ User found BUT without the '+' prefix: ${userNoPlus.phoneNumber}`);
    } else {
         console.log(`❌ No user found even without '+' prefix.`);
    }

  } else {
    console.log("✅ User found:", {
        id: user.id,
        phone: user.phoneNumber,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        orgId: user.orgId
    });

    if (user.organization) {
        console.log("🏢 Organization:", {
            id: user.organization.id,
            name: user.organization.name,
            activeWorkflow: user.organization.activeWorkflow,
            hasConfig: !!user.organization.workflowConfig
        });
        
        if (!user.organization.activeWorkflow) {
            console.error("⛔ CRITICAL: Organization has NO active workflow!");
        }
    } else {
        console.error("❌ User has no organization linked!");
    }
  }

  process.exit(0);
}

debugUser();
