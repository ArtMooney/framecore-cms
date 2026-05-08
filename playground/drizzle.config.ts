import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

const useLocal = process.env.USE_LOCAL_DB === "true";
const useDev = process.env.USE_DEV_DB === "true";

function getLocalDbPath() {
  const wranglerDir = "./.wrangler/state/v3/d1/miniflare-D1DatabaseObject";

  try {
    if (!fs.existsSync(wranglerDir)) {
      throw new Error(
        `Wrangler database directory not found.
        
Run this command first to create the LOCAL database:
  npx wrangler d1 execute [database-name] --local --command="SELECT 1"
  
Note: --local flag ensures this runs against your local dev database, not production.
This will initialize the local D1 database structure.`,
      );
    }

    const files = fs.readdirSync(wranglerDir);
    const sqliteFile = files.find((file) => file.endsWith(".sqlite"));

    if (!sqliteFile) {
      throw new Error(
        `No .sqlite file found in ${wranglerDir}
        
Run this command to create it:
  npx wrangler d1 execute [database-name] --local --command="SELECT 1"`,
      );
    }

    return path.join(wranglerDir, sqliteFile);
  } catch (error) {
    console.error("\n❌ Could not find local database.");
    console.error("\n💡 To fix this, run:");
    console.error(
      '   npx wrangler d1 execute [database-name] --local --command="SELECT 1"',
    );
    console.error("\n   Then run your drizzle-kit command again.\n");
    throw error;
  }
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",

  ...(useLocal
    ? {
        dbCredentials: {
          url: getLocalDbPath(),
        },
      }
    : {
        driver: "d1-http",
        dbCredentials: {
          accountId: process.env.NUXT_CLOUDFLARE_ACCOUNT_ID,
          databaseId: useDev
            ? process.env.NUXT_CLOUDFLARE_DATABASE_ID_DEV
            : process.env.NUXT_CLOUDFLARE_DATABASE_ID,
          token: process.env.NUXT_CLOUDFLARE_D1_TOKEN,
        },
      }),
});
