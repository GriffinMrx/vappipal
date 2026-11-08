// Re-embed chunks whose vectors came from a different embedding model
// (e.g. the mock, before Gemini was connected). Sends one Inngest event per
// document; the local Inngest dev server (`npm run inngest`) must be running.
// Usage: npm run reembed            Refuses to run on the production branch.
import nextEnv from "@next/env";
import { Inngest } from "inngest";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const branch = process.env.NEON_BRANCH;
if (!branch || ["production", "main"].includes(branch)) {
  console.error(`Refusing: NEON_BRANCH is "${branch ?? ""}". Run this on a dev branch.`);
  process.exit(1);
}
const provider = process.env.EMBEDDING_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock");
const model = provider === "gemini" ? process.env.EMBEDDING_MODEL || "gemini-embedding-2" : "mock-hash";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();
try {
  const { rows } = await client.query(
    `SELECT DISTINCT d."id", d."userId" FROM "Document" d
     JOIN "Chunk" c ON c."documentId" = d."id"
     WHERE c."embeddingModel" IS DISTINCT FROM $1`,
    [model],
  );
  if (rows.length === 0) {
    console.log(`All chunks already use ${model}.`);
  } else {
    const inngest = new Inngest({ id: "vappi", isDev: true });
    await inngest.send(rows.map((r) => ({ name: "document/reembed", data: { documentId: r.id, userId: r.userId } })));
    console.log(`Queued ${rows.length} document(s) for re-embedding with ${model} on branch ${branch}. Watch http://localhost:8288`);
  }
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
