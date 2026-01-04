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
