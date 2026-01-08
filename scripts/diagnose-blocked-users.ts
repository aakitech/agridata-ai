import { db } from "../src/server/db/index.ts";
import { appUsers, organizations } from "../src/server/db/schema.ts";
import { eq, sql, and } from "drizzle-orm";

/**
 * Script to diagnose why previously invited users may be blocked from WhatsApp bot
 * 
 * Common issues:
 * 1. isActive set to false
 * 2. User not found (phone number format mismatch)
 * 3. Organization missing activeWorkflow
 * 4. Organization missing workflowConfig
 * 5. User status not ACTIVE
 * 
 * Usage: npx tsx --env-file=.env scripts/diagnose-blocked-users.ts <phone_number>
 */

async function diagnoseUser(phoneInput: string) {
  console.log("🔍 Diagnosing WhatsApp Bot Access Issues");
  console.log("═".repeat(60));
  
  // Normalize phone format
  const phoneWithWhatsApp = phoneInput.startsWith("whatsapp:") 
    ? phoneInput 
    : `whatsapp:${phoneInput}`;
  const phoneClean = phoneWithWhatsApp.replace("whatsapp:", "");
  
  console.log(`\n📱 Checking phone number: ${phoneClean}`);
  console.log("─".repeat(60));
  
  // Try exact match
  let user = await db.query.appUsers.findFirst({
    where: eq(appUsers.phoneNumber, phoneClean),
    with: {
      organization: true
    }
  });
  
  // Try without + prefix
  if (!user && phoneClean.startsWith("+")) {
    const phoneNoPlus = phoneClean.substring(1);
    console.log(`⚠️  Trying without '+' prefix: ${phoneNoPlus}`);
    user = await db.query.appUsers.findFirst({
      where: eq(appUsers.phoneNumber, phoneNoPlus),
      with: { organization: true }
    });
  }
  
  // Try with + prefix
  if (!user && !phoneClean.startsWith("+")) {
    const phoneWithPlus = `+${phoneClean}`;
    console.log(`⚠️  Trying with '+' prefix: ${phoneWithPlus}`);
    user = await db.query.appUsers.findFirst({
      where: eq(appUsers.phoneNumber, phoneWithPlus),
      with: { organization: true }
    });
  }
  
  if (!user) {
    console.log("\n❌ USER NOT FOUND IN DATABASE");
    console.log("─".repeat(60));
    console.log("Possible reasons:");
    console.log("  1. User was never invited");
    console.log("  2. Phone number format mismatch");
    console.log("  3. User was deleted");
    console.log("\n💡 Solution:");
    console.log("  - Re-invite the user through the admin dashboard");
    console.log("  - Ensure phone number matches format: +[country][number]");
    console.log("  - Example: +27794979611 (South Africa)");
    return;
  }
  
  console.log("\n✅ USER FOUND");
  console.log("─".repeat(60));
  
  // Check all potential issues
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Issue 1: isActive flag
  if (!user.isActive) {
    issues.push("❌ CRITICAL: isActive = false (User is deactivated)");
  } else {
    console.log("✅ isActive: true");
  }
  
  // Issue 2: User status
  if (user.status !== "ACTIVE") {
    warnings.push(`⚠️  User status is '${user.status}' (expected: ACTIVE)`);
  } else {
    console.log("✅ status: ACTIVE");
  }
  
  // Issue 3: Organization
  if (!user.organization) {
    issues.push("❌ CRITICAL: No organization linked");
  } else {
    console.log(`✅ Organization: ${user.organization.name} (${user.organization.id})`);
    
    // Issue 4: Active workflow
    if (!user.organization.activeWorkflow) {
      issues.push("❌ CRITICAL: Organization has no activeWorkflow");
    } else {
      console.log(`✅ activeWorkflow: ${user.organization.activeWorkflow}`);
    }
    
    // Issue 5: Workflow config
    if (!user.organization.workflowConfig) {
      issues.push("❌ CRITICAL: Organization has no workflowConfig");
    } else {
      console.log("✅ workflowConfig: present");
    }
  }
  
  // Display results
  console.log("\n" + "═".repeat(60));
  console.log("DIAGNOSIS SUMMARY");
  console.log("═".repeat(60));
  
  console.log("\nUser Details:");
  console.log(`  ID:          ${user.id}`);
  console.log(`  Name:        ${user.fullName || "N/A"}`);
  console.log(`  Phone:       ${user.phoneNumber}`);
  console.log(`  Email:       ${user.email || "N/A"}`);
  console.log(`  Role:        ${user.role}`);
  console.log(`  Status:      ${user.status}`);
  console.log(`  isActive:    ${user.isActive}`);
  console.log(`  Created:     ${user.createdAt.toISOString()}`);
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log("\n🎉 NO ISSUES FOUND!");
    console.log("─".repeat(60));
    console.log("This user should be able to access the WhatsApp bot.");
    console.log("\nIf they still can't access:");
    console.log("  1. Check Twilio webhook is correctly configured");
    console.log("  2. Verify backend is running and accessible");
    console.log("  3. Check Twilio console logs for errors");
  } else {
    if (issues.length > 0) {
      console.log("\n🔥 CRITICAL ISSUES (BLOCKING ACCESS):");
      console.log("─".repeat(60));
      issues.forEach(issue => console.log(issue));
    }
    
    if (warnings.length > 0) {
      console.log("\n⚠️  WARNINGS:");
      console.log("─".repeat(60));
      warnings.forEach(warning => console.log(warning));
    }
    
    console.log("\n💡 RECOMMENDED FIXES:");
    console.log("─".repeat(60));
    
    if (!user.isActive) {
      console.log(`\n1. Reactivate user:`);
      console.log(`   UPDATE app_users SET is_active = true WHERE id = '${user.id}';`);
    }
    
    if (user.status !== "ACTIVE") {
      console.log(`\n2. Update user status:`);
      console.log(`   UPDATE app_users SET status = 'ACTIVE' WHERE id = '${user.id}';`);
    }
    
    if (user.organization && !user.organization.activeWorkflow) {
      console.log(`\n3. Set organization active workflow:`);
      console.log(`   Run: npm run seed:workflows`);
      console.log(`   Or manually update organizations.active_workflow`);
    }
  }
  
  console.log("\n" + "═".repeat(60));
}

// Get phone number from command line
const phoneArg = process.argv[2];

if (!phoneArg) {
  console.error("❌ Usage: npx tsx --env-file=.env scripts/diagnose-blocked-users.ts <phone_number>");
  console.error("   Example: npx tsx --env-file=.env scripts/diagnose-blocked-users.ts +27794979611");
  process.exit(1);
}

diagnoseUser(phoneArg)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Error:", error);
    process.exit(1);
  });
