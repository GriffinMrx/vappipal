import { PageHeader } from "@/components/layout/page-header";
import { HomeSpaces, NewSpaceButton } from "@/components/spaces/space-views";
import { getCurrentDbUser } from "@/lib/auth/current-user";
import { listSpaces } from "@/lib/spaces/queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Spaces · Vappi" };

/** All of the user's spaces (same grid as Home, with optimistic create/edit/delete). */
export default async function SpacesPage() {
  const user = await getCurrentDbUser();
  const spaces = await listSpaces(user.id);
  return (
    <>
      <PageHeader eyebrow="Library" title="Your spaces" actions={<NewSpaceButton variant="accent" />} />
      <div className="mt-8">
        <HomeSpaces spaces={spaces} />
      </div>
    </>
  );
}
