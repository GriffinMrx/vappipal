import { FloatingNavbar } from "@/components/aceternity/floating-navbar";
import { Logo } from "@/components/layout/logo";
import { MenuAuth, NavAuth } from "./auth-buttons";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNavbar() {
  return (
    <FloatingNavbar
      logo={
        <a href="#top" aria-label="Vappi, back to top" className="inline-flex min-h-11 items-center rounded-control">
          <Logo height={26} />
        </a>
      }
      links={LINKS}
      actions={<NavAuth />}
      menuActions={<MenuAuth />}
    />
  );
}
