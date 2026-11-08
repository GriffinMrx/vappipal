import { BentoGrid, BentoGridItem } from "@/components/aceternity/bento-grid";
import { AskProfile, CreateBoard, GoalCurve, LearnOrbs, UploadTiles } from "./bento-visuals";
import { SectionIntro } from "./section-intro";

/** Features bento, laid out like the Aceternity reference: wide + 1, then 1 + 1 + 1. */
export function FeaturesBento() {
  return (
    <section id="features" className="scroll-mt-24 px-5 py-16 sm:px-6 sm:py-24">
      <SectionIntro
        eyebrow="Features"
        title="Learn it. Ask it. Make something from it."
        text="Everything Vappi makes comes from the files in your Space, and it always shows the page it came from."
      />
      <BentoGrid className="mt-12 lg:auto-rows-[minmax(28rem,auto)]">
        <BentoGridItem
          className="md:col-span-2"
          textPosition="top"
          title="Upload anything, all in one Space"
          description="PDFs, PowerPoint slides, Word files and photos of handwritten notes. Vappi reads them page by page in a minute or two."
          visual={<UploadTiles />}
        />
        <BentoGridItem
          title="A plan up to your goal"
          description="Add an exam or a deadline and get a plan for every day, with flashcards on the days they're due."
          visual={<GoalCurve />}
        />
        <BentoGridItem
          title="Learn from your files"
          description="Short and long summaries, flashcards with spaced repetition, and quizzes with the source page."
          visual={<LearnOrbs />}
        />
        <BentoGridItem
          title="Create something new"
          description="Notes, outlines, checklists, emails and blog posts, written from your files with the pages they used."
          visual={<CreateBoard />}
        />
        <BentoGridItem
          title="Ask, with page links"
          description="Chat with your files. Every answer cites its pages, and Vappi tells you when the files don't say."
          visual={<AskProfile />}
        />
      </BentoGrid>
    </section>
  );
}
