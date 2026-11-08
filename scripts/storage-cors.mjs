// Allow the browser to upload to / read from the private course-files bucket
// (presigned POST + GET). Run once per Neon branch: npm run storage:cors
// Refuses to run on production; production CORS is set at deploy time.
import nextEnv from "@next/env";
import { networkInterfaces } from "node:os";
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

nextEnv.loadEnvConfig(process.cwd());

const branch = process.env.NEON_BRANCH;
if (!branch || ["production", "main"].includes(branch)) {
  console.error(`Refusing: NEON_BRANCH is "${branch ?? ""}". Run this on a dev branch.`);
  process.exit(1);
}

const bucket = process.env.STORAGE_BUCKET || "course-files";
const origins = ["http://localhost:3000", "https://*.trycloudflare.com"];
// This PC's LAN addresses, so phones / other devices on the network can upload in dev.
for (const a of Object.values(networkInterfaces()).flat()) {
  if (a && a.family === "IPv4" && !a.internal) origins.push(`http://${a.address}:3000`);
}
if (process.env.APP_URL) origins.push(new URL(process.env.APP_URL).origin);

const s3 = new S3Client({ forcePathStyle: true });
await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ["POST", "GET", "HEAD"],
          AllowedHeaders: ["*"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
const res = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log(`CORS on "${bucket}" (branch ${branch}):`, JSON.stringify(res.CORSRules?.[0]?.AllowedOrigins));
