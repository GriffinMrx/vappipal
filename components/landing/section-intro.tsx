import { cn } from "@/lib/cn";

export function SectionIntro({
  eyebrow,
  title,
  text,
  className,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-2xl flex-col items-center text-center", className)}>
      <span className="text-eyebrow font-semibold tracking-wider text-fg-subtle uppercase">{eyebrow}</span>
      <h2 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight text-balance text-fg sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {text && <p className="mt-4 text-base leading-relaxed text-pretty text-fg-muted">{text}</p>}
    </div>
  );
}
