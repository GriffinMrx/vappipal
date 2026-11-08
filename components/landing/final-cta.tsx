import { GridBackground } from "@/components/aceternity/grid-background";
import { MovingBorder } from "@/components/aceternity/moving-border";
import { VappiPal } from "@/components/pal/vappi-pal";
import { CtaButton } from "./auth-buttons";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28">
      <GridBackground variant="dot" />
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        <VappiPal mood="happy" size={88} label={false} />
        <h2 className="mt-6 text-3xl leading-tight font-extrabold tracking-tight text-balance text-fg sm:text-5xl">
          Your files already know the answers
        </h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-fg-muted">
          Upload one and see what Vappi makes from it in about two minutes.
        </p>
        <MovingBorder className="mt-8" rx="22">
          <CtaButton
            label="Start with your first file"
            variant="subtle"
            className="rounded-pill! bg-bg! px-6 text-fg hover:bg-surface!"
          />
        </MovingBorder>
      </div>
    </section>
  );
}
