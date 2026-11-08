// Mock Pro access for testing (billing is built last): adds or removes a
// test-mode Exam Pass row for a user on the DEV branch.
// Usage: npm run dev:pro -- <clerk user id> on|off
import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const branch = process.env.NEON_BRANCH;
if (!branch || ["production", "main"].includes(branch)) {
  console.error(`Refusing: NEON_BRANCH is "${branch ?? ""}". Mock Pro only on a dev branch.`);
  process.exit(1);
}
const [userId, mode] = process.argv.slice(2);
if (!userId?.startsWith("user_") || !["on", "off"].includes(mode)) {
  console.error("Usage: npm run dev:pro -- <clerk user id (user_…)> on|off");
  process.exit(1);
}

const lsId = `dev-mock-pass-${userId}`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();
try {
  await client.query(`DELETE FROM "Subscription" WHERE "lemonSqueezyId" = $1`, [lsId]);
  if (mode === "on") {
    const { rowCount } = await client.query(
      `INSERT INTO "Subscription" ("id","userId","lemonSqueezyId","kind","variantId","status","testMode","endsAt","updatedAt")
       SELECT $1, "id", $1, 'EXAM_PASS', 'dev-mock', 'PAID', true, now() + interval '30 days', now()
       FROM "User" WHERE "id" = $2`,
      [lsId, userId],
    );
    if (rowCount === 0) throw new Error("No User row for that id. Sign in to the app once first.");
  }
  console.log(`Mock Pro ${mode} for ${userId} on branch ${branch}.`);
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
