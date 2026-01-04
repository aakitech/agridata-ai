
import fs from "fs";
import path from "path";

async function main() {
  // Load env FIRST
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
      const [key, ...value] = line.split("=");
      if (key && value) {
        const val = value.join("=").trim().replace(/^["'](.*)["']$/, '$1');
        process.env[key.trim()] = val;
      }
    });
  }

  // Then import DB
  const { db } = await import("../src/server/db/index");
  // const { organizations } = await import("../src/server/db/schema");

  console.log("Fetching organizations...");
  const orgs = await db.query.organizations.findMany();
  console.log(JSON.stringify(orgs, null, 2));
  process.exit(0);
}

main().catch(console.error);
