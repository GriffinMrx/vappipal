// Clear the Next.js cache (.next) safely, then start the dev server.
// Usage: npm run dev:clean   (extra args go to `next dev`, e.g. npm run dev:clean -- -p 3001)
//
// Why: deleting .next while `next dev` runs (or a half-finished delete on
// Windows, where open files are locked) can leave a stale Turbopack cache. The
// dev server then reports a "change" on every request and the browser reloads
// forever ("HMR hash mismatch"). See prompts/47-dev-reload-loop.md.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(root, ".next");
const lockFile = join(nextDir, "dev", "lock");

// Only ever delete <project>/.next.
if (!existsSync(join(root, "package.json")) || nextDir !== join(root, ".next")) {
  console.error("Refusing: could not find the project folder.");
  process.exit(1);
}

// 1. Refuse while a dev server is running.
if (existsSync(lockFile)) {
  let pid;
  try {
    pid = JSON.parse(readFileSync(lockFile, "utf8")).pid;
  } catch {
    pid = undefined;
  }
  if (Number.isInteger(pid) && isAlive(pid)) {
    console.error(`A dev server is still running (process ${pid}).`);
    console.error("Stop `npm run dev` first (Ctrl+C in its terminal), then run this again.");
    process.exit(1);
  }
}

// 2. Delete .next completely (retrying while Windows releases file locks).
if (existsSync(nextDir)) {
  try {
    rmSync(nextDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.error(`Could not delete .next: ${err.code ?? ""} ${err.path ?? err.message}`);
    console.error("Close anything that uses it (a dev server, `next build`, an editor preview) and try again.");
    process.exit(1);
  }
  if (existsSync(nextDir)) {
    const left = readdirSync(nextDir, { recursive: true }).slice(0, 5).join(", ");
    console.error(`.next was not fully deleted (still there: ${left || "the folder itself"}). Try again.`);
    process.exit(1);
  }
}
console.log("✓ Cleared .next");

// 3. Start the dev server.
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM"; // exists but owned by someone else
  }
}
