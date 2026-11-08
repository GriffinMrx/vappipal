// Dev-only sample data for one student, so UI features can be built before
// the processing pipeline exists. Run: npm run db:seed -- <clerk user id>
// Refuses to run unless NEON_BRANCH is set and is not the production branch.
// Idempotent: rebuilds only the "Sample: Cell biology" space of that user.
import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const branch = process.env.NEON_BRANCH;
if (!branch || ["production", "main"].includes(branch)) {
  console.error(`Refusing to seed: NEON_BRANCH is "${branch ?? ""}". Seed only a dev branch.`);
  process.exit(1);
}
const userId = process.argv[2];
if (!userId?.startsWith("user_")) {
  console.error("Usage: npm run db:seed -- <clerk user id (user_…)>");
  process.exit(1);
}

const SPACE_NAME = "Sample: Cell biology";
const id = () => randomUUID().replaceAll("-", "");
const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const pages = [
  "The cell is the basic unit of life. All living organisms are made of one or more cells.",
  "The cell membrane is a phospholipid bilayer that controls what enters and leaves the cell.",
  "Mitochondria produce ATP through cellular respiration. They have their own DNA.",
  "The nucleus stores DNA and controls gene expression. It is surrounded by the nuclear envelope.",
  "Ribosomes build proteins by translating messenger RNA. They are found free or on the rough ER.",
  "Mitosis produces two identical daughter cells: prophase, metaphase, anaphase, telophase.",
];

const flashcards = [
  ["What is the basic unit of life?", "The cell.", 1, -1],
  ["What is the cell membrane made of?", "A phospholipid bilayer.", 2, 0],
  ["What do mitochondria produce?", "ATP, through cellular respiration.", 3, 0],
  ["Where is DNA stored in the cell?", "In the nucleus.", 4, 2],
  ["What do ribosomes do?", "They build proteins by translating mRNA.", 5, 3],
  ["Name the phases of mitosis in order.", "Prophase, metaphase, anaphase, telophase.", 6, 5],
];

const questions = [
  ["MULTIPLE_CHOICE", "Which organelle produces ATP?", ["Nucleus", "Mitochondrion", "Ribosome", "Golgi apparatus"], "Mitochondrion", "Mitochondria produce ATP through cellular respiration.", 3],
  ["MULTIPLE_CHOICE", "What surrounds the nucleus?", ["Cell wall", "Nuclear envelope", "Cytoplasm", "Ribosomes"], "Nuclear envelope", "The nucleus is surrounded by the nuclear envelope.", 4],
  ["SHORT_ANSWER", "What does the cell membrane control?", [], "What enters and leaves the cell.", "The membrane is a selective barrier.", 2],
  ["SHORT_ANSWER", "How many daughter cells does mitosis produce?", [], "Two identical daughter cells.", "Mitosis ends with two identical cells.", 6],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();
try {
  const { rows } = await client.query(`SELECT 1 FROM "User" WHERE "id" = $1`, [userId]);
  if (rows.length === 0) throw new Error("No User row for that id. Sign in to the app once first.");

  await client.query("BEGIN");
  // Cascades remove the old sample's documents, chunks, cards, questions, plan days.
  await client.query(`DELETE FROM "Space" WHERE "userId" = $1 AND "name" = $2`, [userId, SPACE_NAME]);

  const spaceId = id();
  await client.query(
    `INSERT INTO "Space" ("id","userId","name","goalDate","color","updatedAt") VALUES ($1,$2,$3,$4,'GREEN',now())`,
    [spaceId, userId, SPACE_NAME, day(14)],
  );

  const documentId = id();
  await client.query(
    `INSERT INTO "Document" ("id","spaceId","userId","title","fileKey","fileType","mimeType","sizeBytes","status","pageCount","pagesProcessed","updatedAt")
     VALUES ($1,$2,$3,'Cell biology – lecture 1.pdf',$4,'PDF','application/pdf',184320,'READY',$5,$5,now())`,
    [documentId, spaceId, userId, `seed/${documentId}.pdf`, pages.length],
  );
  for (const step of ["EXTRACT", "EMBED", "SUMMARY", "FLASHCARDS", "QUIZ"]) {
    await client.query(
      `INSERT INTO "DocumentStep" ("id","documentId","step","status","attempts","updatedAt") VALUES ($1,$2,$3,'DONE',1,now())`,
      [id(), documentId, step],
    );
  }
  for (const [i, text] of pages.entries()) {
    await client.query(
      `INSERT INTO "Chunk" ("id","documentId","userId","spaceId","page","index","text") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id(), documentId, userId, spaceId, i + 1, i, text],
    );
  }
  await client.query(
    `INSERT INTO "Summary" ("id","documentId","short","long","keyTerms","updatedAt") VALUES ($1,$2,$3,$4,$5,now())`,
    [
      id(),
      documentId,
      "Cells are the basic unit of life. The membrane controls exchange, mitochondria make ATP, the nucleus stores DNA, ribosomes build proteins, and mitosis makes two identical cells.",
      pages.join("\n\n"),
      ["cell", "cell membrane", "mitochondria", "ATP", "nucleus", "ribosomes", "mitosis"],
    ],
  );
  for (const [front, back, page, dueIn] of flashcards) {
    await client.query(
      `INSERT INTO "Flashcard" ("id","spaceId","documentId","userId","front","back","sourcePage","nextReviewAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7, now() + make_interval(days => $8), now())`,
      [id(), spaceId, documentId, userId, front, back, page, dueIn],
    );
  }
  for (const [type, question, options, answer, explanation, page] of questions) {
    await client.query(
      `INSERT INTO "Question" ("id","spaceId","documentId","userId","type","question","options","answer","explanation","sourcePage")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id(), spaceId, documentId, userId, type, question, options, answer, explanation, page],
    );
  }
  for (let d = 0; d < 3; d++) {
    const tasks = [
      d === 0 && { kind: "summary", documentId, done: false },
      { kind: "flashcards", count: 5, done: false },
      { kind: "quiz", count: 4, done: false },
    ].filter(Boolean);
    await client.query(
      `INSERT INTO "PlanDay" ("id","spaceId","userId","date","tasks","updatedAt") VALUES ($1,$2,$3,$4,$5,now())`,
      [id(), spaceId, userId, day(d), JSON.stringify(tasks)],
    );
  }
  await client.query("COMMIT");
  console.log(`Seeded "${SPACE_NAME}" on branch ${branch}: 1 document, ${pages.length} chunks, ${flashcards.length} flashcards, ${questions.length} questions, 3 plan days.`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
