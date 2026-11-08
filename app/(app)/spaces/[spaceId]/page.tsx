import { ChatPanelLayout, ChatToggleButton } from "@/components/chat/chat-panel";
import { AskIntro } from "@/components/chat/ask-intro";
import { SpaceChatSlot } from "@/components/chat/space-chat-slot";
import { CreatePanel } from "@/components/create/create-panel";
import { creationAllowance, listCreations } from "@/lib/creations/queries";
import { Icon } from "@/components/icons/icon";
import { SpaceDocuments, UploadButton } from "@/components/documents/space-documents";
import { FlashcardReview } from "@/components/study/flashcard-review";
import { QuizRunner } from "@/components/study/quiz-runner";
import { SummaryView } from "@/components/study/summary-view";
import { PlanProvider } from "@/components/planner/plan-provider";
import { PlannerUpgrade } from "@/components/planner/planner-upgrade";
import { SpacePlanCard } from "@/components/planner/space-plan-card";
import { EditSpaceButton, SpaceHeader } from "@/components/spaces/space-header";
import { LEARN_TABS, modeOf, parseTab, spaceTabHref, SpaceTabs } from "@/components/spaces/space-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { hasProAccess } from "@/lib/billing/access";
import { dateColumnToDay, dayInZone } from "@/lib/dates";
import { getPlans } from "@/lib/planner/queries";
import { getUploadAllowance, listDocuments } from "@/lib/documents/queries";
import { getDueCards, getQuizInfo, getQuizQuestions, getStudyCounts, listSummaries } from "@/lib/study/queries";
import { verifyQuizToken } from "@/lib/study/quiz-token";
import { getSpace } from "@/lib/spaces/queries";
import type { SpaceColor } from "@/lib/generated/prisma/enums";
import { notFound } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Space page: Files · Learn (Summary, Flashcards, Quiz, Plan) · Ask (chat side panel) · Create. Tab in the URL. */
export default async function SpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: SearchParams;
}) {
  const [{ spaceId }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentDbUser();
  const space = await getSpace(user.id, spaceId);
  if (!space) notFound();

  const tab = parseTab(sp.tab);
  // The Files tab's upload allowance loads alongside, not after, the documents.
  const [documents, counts, uploadAllowance] = await Promise.all([
    listDocuments(user.id, space.id, user.timeZone),
    getStudyCounts(user.id, space.id, user.timeZone),
    tab === "documents" ? getUploadAllowance(user.id) : null,
  ]);

  const view = {
    id: space.id,
    name: space.name,
    color: space.color,
    goalDate: space.goalDate ? dateColumnToDay(space.goalDate) : null,
    goalLabel: space.goalLabel,
  };
  const mode = modeOf(tab);
  const href = (t: Parameters<typeof spaceTabHref>[1]) => spaceTabHref(space.id, t);
  const learnLabels = { summary: "Summary", flashcards: "Flashcards", quiz: "Quiz", plan: "Plan" } as const;
  const learnBadges: Partial<Record<(typeof LEARN_TABS)[number], string>> = {
    flashcards: counts.due ? `${counts.due} due` : undefined,
    quiz: counts.questions ? String(counts.questions) : undefined,
  };

  return (
    <ChatPanelLayout
      initiallyOpen={mode === "ask"}
      chat={<SpaceChatSlot userId={user.id} spaceId={space.id} spaceName={space.name} />}
    >
      <SpaceHeader
        space={view}
        documentCount={documents.length}
        actions={
          <>
            {tab === "documents" && <UploadButton icon={<Icon name="rectagular-upload" size={18} />} />}
            <ChatToggleButton />
          </>
        }
      />

      <div className="mt-6 flex flex-col gap-3">
        <SpaceTabs
          label="Space modes"
          active={mode}
          items={[
            { key: "files", label: "Files", href: href("documents"), badge: documents.length ? String(documents.length) : undefined },
            { key: "learn", label: "Learn", href: href("summary"), badge: counts.due ? `${counts.due} due` : undefined },
            { key: "ask", label: "Ask", href: href("ask") },
            { key: "create", label: "Create", href: href("create") },
          ]}
        />
        {mode === "learn" && (
          <SpaceTabs
            label="Learn"
            size="sm"
            active={tab}
            items={LEARN_TABS.map((t) => ({ key: t, label: learnLabels[t], href: href(t), badge: learnBadges[t] }))}
          />
        )}
      </div>

      <section className="mt-6" aria-label={tab}>
        {tab === "documents" && uploadAllowance && (
          <SpaceDocuments spaceId={space.id} documents={documents} allowance={uploadAllowance} />
        )}
        {tab === "summary" && (
          <SummaryView
            spaceId={space.id}
            entries={await listSummaries(user.id, space.id, user.timeZone)}
            selectedId={one(sp.doc) ?? null}
          />
        )}
        {tab === "flashcards" && <FlashcardsTab userId={user.id} spaceId={space.id} timeZone={user.timeZone} />}
        {tab === "quiz" && <QuizTab userId={user.id} spaceId={space.id} token={one(sp.t) ?? null} />}
        {tab === "plan" && <PlanTab userId={user.id} timeZone={user.timeZone} space={view} />}
        {tab === "ask" && <AskIntro spaceName={space.name} />}
        {tab === "create" && (
          <CreateTab userId={user.id} spaceId={space.id} hasFiles={documents.some((d) => d.status === "READY")} />
        )}
      </section>
    </ChatPanelLayout>
  );
}

async function FlashcardsTab({ userId, spaceId, timeZone }: { userId: string; spaceId: string; timeZone: string }) {
  const { cards, total, nextDueAt } = await getDueCards(userId, spaceId, timeZone);
  // Keyed by the due set so a fresh visit starts a fresh session.
  return (
    <FlashcardReview
      key={cards.map((c) => c.id).join(",")}
      spaceId={spaceId}
      cards={cards}
      totalCards={total}
      nextDueAt={nextDueAt}
      timeZone={timeZone}
    />
  );
}

async function QuizTab({ userId, spaceId, token }: { userId: string; spaceId: string; token: string | null }) {
  const quiz = token ? verifyQuizToken(token, userId) : null;
  const [info, questions] = await Promise.all([
    getQuizInfo(userId, spaceId),
    quiz ? getQuizQuestions(userId, spaceId, quiz.questionIds) : Promise.resolve([]),
  ]);
  return (
    <QuizRunner key={token ?? "start"} spaceId={spaceId} info={info} token={quiz ? token : null} questions={questions} />
  );
}


async function PlanTab({
  userId,
  timeZone,
  space,
}: {
  userId: string;
  timeZone: string;
  space: { id: string; name: string; color: SpaceColor; goalDate: string | null; goalLabel: string | null };
}) {
  if (!(await hasProAccess(userId))) return <PlannerUpgrade />;
  const [plan] = await getPlans(userId, timeZone, space.id);
  if (!plan || plan.daysLeft === null || plan.daysLeft < 0) {
    return (
      <EmptyState
        icon={<Icon name="planner" size={24} />}
        title={plan?.daysLeft !== null && plan?.daysLeft !== undefined ? "This goal date has passed" : "No goal date yet"}
        description="Add a goal date (an exam, a presentation, a deadline…) and Vappi will plan each day until then: what to read, which cards to review and when to take a quiz."
        action={<EditSpaceButton space={space} label="Add goal date" variant="accent" />}
      />
    );
  }
  return (
    <PlanProvider>
      <SpacePlanCard plan={plan} today={dayInZone(timeZone)} showTitle={false} />
    </PlanProvider>
  );
}

async function CreateTab({ userId, spaceId, hasFiles }: { userId: string; spaceId: string; hasFiles: boolean }) {
  const [items, allowance] = await Promise.all([listCreations(userId, spaceId), creationAllowance(userId)]);
  return <CreatePanel spaceId={spaceId} items={items} allowance={allowance} hasFiles={hasFiles} />;
}
