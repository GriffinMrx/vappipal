import { StickyScroll } from "@/components/aceternity/sticky-scroll-reveal";
import { VappiPal } from "@/components/pal/vappi-pal";
import { ModesStep, ReadStep, UploadStep } from "./previews";
import { SectionIntro } from "./section-intro";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-5 py-16 sm:px-6 sm:py-24">
      <SectionIntro eyebrow="How it works" title="From a file to a plan in three steps" />
      <StickyScroll
        className="mx-auto mt-12 w-full max-w-6xl lg:mt-4"
        steps={[
          {
            title: "Create a Space and upload",
            description:
              "Make a Space for any topic, add a goal date if you have one, and drop in your PDFs, slides, Word files or photos of notes.",
            content: <UploadStep />,
          },
          {
            title: "Vappi reads it in a minute or two",
            description:
              "It pulls the text out page by page, reads handwriting with OCR, and writes a summary for each file. You see every file go from Processing to Ready.",
            content: <ReadStep pal={<VappiPal mood="searching" size={72} label={false} />} />,
          },
          {
            title: "Learn it, ask it, or make something",
            description:
              "Study with flashcards and quizzes, chat with your files, or create notes, outlines, checklists, emails and blog posts. Every result links to its pages.",
            content: <ModesStep />,
          },
        ]}
      />
    </section>
  );
}
