import Link from "next/link";

/** Outlined card from the reference: hairline border, dim text, white button. */
export function UpgradeCard({
  title,
  description,
  cta,
  href,
}: {
  title: string;
  description: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-card border border-sidebar-line bg-bg-sidebar px-4 pt-6 pb-4">
      <p className="text-sm font-semibold text-sidebar-card-title">{title}</p>
      <p className="mt-3 text-xs leading-[1.6] text-sidebar-card-text">{description}</p>
      <Link
        href={href}
        className="mt-8 flex h-11 w-full items-center justify-center rounded-lg bg-[#fafafa] text-xs font-semibold text-black ring-1 ring-sidebar-line transition-colors hover:bg-fg-body lg:h-[2.125rem]"
      >
        {cta}
      </Link>
    </div>
  );
}
