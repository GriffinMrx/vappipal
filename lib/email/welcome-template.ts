import { buttonRow, card, cardsRow, emailShell, esc, introRow } from "./layout";

/** The one-time welcome email (prompt 37). First name only; no prices or limits. */
export function renderWelcome(firstName: string, urls: { start: string; settings: string }) {
  const subject = "Welcome to Vappi";
  const steps = [
    ["1 · Create a Space", "One for each topic: a class, a work project, a hobby."],
    ["2 · Upload your files", "PDF, PowerPoint, Word, or photos of your notes. Vappi reads them in a minute or two."],
    ["3 · Learn, Ask or Create", "Summaries, flashcards and quizzes, answers with the pages they come from, and new notes, emails or posts made from your files."],
  ] as const;

  const html = emailShell({
    title: subject,
    preheader: `Hi ${firstName}, here's how to get started with your AI pal.`,
    rows:
      introRow(`Hi ${firstName}, welcome to Vappi`, "Your AI pal for your own files. Here's how to start:") +
      cardsRow(steps.map(([t, d]) => card(t, d)).join("")) +
      buttonRow(urls.start, "Create your first Space"),
    footer: `You're getting this because you created a Vappi account.<br>
        <a href="${esc(urls.settings)}" style="color:#4b4b52">Settings</a>`,
  });

  const text = [
    `Hi ${firstName}, welcome to Vappi.`,
    "Your AI pal for your own files. Here's how to start:",
    "",
    ...steps.map(([t, d]) => `${t}: ${d}`),
    "",
    `Create your first Space: ${urls.start}`,
    "",
    "You're getting this because you created a Vappi account.",
  ].join("\n");

  return { subject, html, text };
}
