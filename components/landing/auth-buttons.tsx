import { buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

/* Clerk's <Show> reads the session on the server, so each group sits in Suspense. */

function Boundary({ children, fallback }: { children: ReactNode; fallback: string }) {
  return <Suspense fallback={<Skeleton className={cn("rounded-control", fallback)} />}>{children}</Suspense>;
}

/** Navbar: Sign in + Get started, or Open Vappi. Sign in hides on phones (it's in the menu). */
export function NavAuth() {
  return (
    <Boundary fallback="h-11 w-28 lg:h-9">
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className={buttonClasses({ variant: "ghost", className: "hidden sm:inline-flex" })}>
            Sign in
          </button>
        </SignInButton>
        <SignUpButton>
          <button type="button" className={buttonClasses({ variant: "primary" })}>
            Get started
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href="/home" className={buttonClasses({ variant: "primary" })}>
          Open Vappi
        </Link>
      </Show>
    </Boundary>
  );
}

/** Mobile menu: a full-width Sign in for signed-out visitors. */
export function MenuAuth() {
  return (
    <Boundary fallback="h-11 w-full">
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className={buttonClasses({ variant: "subtle", size: "lg", className: "w-full" })}>
            Sign in
          </button>
        </SignInButton>
      </Show>
    </Boundary>
  );
}

/** A main call to action: sign up when signed out, open the app when signed in. */
export function CtaButton({
  label,
  signedInLabel = "Open Vappi",
  signedInHref = "/home",
  variant = "accent",
  className,
  arrow = true,
}: {
  label: string;
  signedInLabel?: string;
  signedInHref?: string;
  variant?: ButtonVariant;
  className?: string;
  arrow?: boolean;
}) {
  const classes = buttonClasses({ variant, size: "lg", className });
  const icon = arrow ? <ArrowRight size={16} aria-hidden /> : null;
  return (
    <Boundary fallback={cn("h-11 w-44", className)}>
      <Show when="signed-out">
        <SignUpButton>
          <button type="button" className={classes}>
            {label}
            {icon}
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href={signedInHref} className={classes}>
          {signedInLabel}
          {icon}
        </Link>
      </Show>
    </Boundary>
  );
}

/** Secondary hero action: Sign in, hidden once signed in. */
export function SignInCta({ className }: { className?: string }) {
  return (
    <Boundary fallback={cn("h-11 w-28", className)}>
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className={buttonClasses({ variant: "subtle", size: "lg", className })}>
            Sign in
          </button>
        </SignInButton>
      </Show>
    </Boundary>
  );
}
