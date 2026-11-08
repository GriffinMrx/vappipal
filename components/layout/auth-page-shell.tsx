import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

/** Centred layout for the Clerk sign-in / sign-up pages. */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/" aria-label="Vappi home" className="inline-flex min-h-11 items-center rounded-md">
        <Logo height={40} />
      </Link>
      <div className="w-full max-w-[25rem] [&>div]:mx-auto">{children}</div>
    </main>
  );
}
