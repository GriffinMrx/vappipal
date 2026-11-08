import { Logo } from "@/components/layout/logo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border px-5 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-start">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Logo height={24} />
          <p className="text-sm text-fg-subtle">Your AI pal for your own files.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap justify-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-flex h-11 items-center rounded-control px-3 text-sm text-fg-muted transition-colors hover:text-fg"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
