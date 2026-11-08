import { AuthPageShell } from "@/components/layout/auth-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <AuthPageShell>
      {/* SignUp reads the URL, so it must sit inside Suspense with Cache Components. */}
      <Suspense fallback={<Skeleton className="h-[30rem] w-full rounded-card" />}>
        <SignUp />
      </Suspense>
    </AuthPageShell>
  );
}
