# Utility Scripts

This directory contains maintenance and manual configuration scripts for the application.

## How to Run
All scripts are written in TypeScript and can be run using `tsx`. You must include the env file to access database credentials.

**Command Format:**
```bash
npx tsx --env-file=.env scripts/<script-name>.ts
```

---

## Available Scripts

### `whatsapp-bot-seed-workflows.ts`
**Command:** `npm run seed:workflows`
- **Purpose**: Updates the `organizations` table with the latest workflow configurations defined in this file.
- **When to run**: Whenever you change question text, add steps, or modify validation logic in the code.

### `cleanup-test-data.ts`
- **Purpose**: TARGETED deletion of dummy test users created during development (`+263770000000` and `+263779999999`).
- **Safety**: Checks for specific phone numbers. Will not delete real users.

### `bootstrap-admin.ts`
- **Purpose**: Creates an initial super admin user if one does not exist.
- **Usage**: Used during initial project setup.
### `diagnose-blocked-users.ts`
**Command:** `npm run diagnose:user <phone_number>`
- **Purpose**: Diagnoses why a previously invited user cannot access the WhatsApp bot
- **Checks**:
  - User exists in database (with phone format variations)
  - `isActive` flag is true
  - User status is ACTIVE
  - Organization is linked
  - Organization has active workflow configured
- **Example**: `npm run diagnose:user +27794979611`
- **When to use**: When a field officer reports they cannot access the bot

### `fix-blocked-user.ts`
**Command:** `npm run fix:user <phone_number>`
- **Purpose**: Automatically fixes common issues blocking WhatsApp bot access
- **Fixes**:
  - Sets `isActive = true`
  - Sets `status = 'ACTIVE'`
- **Example**: `npm run fix:user +27794979611`
- **When to use**: After diagnosing an issue, use this to quickly reactivate the user