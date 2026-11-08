import { FeaturesBento } from "@/components/landing/features-bento";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingNavbar } from "@/components/landing/navbar";
import { Pricing } from "@/components/landing/pricing";
import { SourceBand } from "@/components/landing/source-band";
import { Testimonials } from "@/components/landing/testimonials";
import { FREE_CREATIONS_PER_WEEK, FREE_LIMITS, PRICES } from "@/lib/plans";
import type { Metadata } from "next";

export const metadata: Metadata = {
  openGraph: {
    title: "Vappi, your AI pal for your own files",
    description: "Upload anything, then learn it, ask it, or make something from it. Every answer shows its source page.",
  },
};

/** Public landing page (prompt 44). */
export default function Home() {
  return (
    <div className="landing overflow-x-clip">
      <LandingNavbar />
      <main>
        <Hero />
        <FeaturesBento />
        <SourceBand />
        <HowItWorks />
        <Testimonials />
        <Pricing
          prices={{ ...PRICES }}
          freeLimits={{
            documents: FREE_LIMITS.document,
            flashcards: FREE_LIMITS.flashcards,
            quizzes: FREE_LIMITS.quiz,
            creations: FREE_CREATIONS_PER_WEEK,
          }}
        />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
