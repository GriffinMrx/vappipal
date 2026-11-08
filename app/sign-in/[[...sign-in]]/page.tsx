import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <AuthPageShell>
      {/* SignIn reads the URL, so it must sit inside Suspense with Cache Components. */}
      <Suspense fallback={<Skeleton className="h-[26rem] w-full rounded-card" />}>
        <SignIn />
      </Suspense>
    </AuthPageShell>
  );
}
