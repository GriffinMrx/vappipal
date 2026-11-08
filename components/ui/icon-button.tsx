import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  variant?: "ghost" | "subtle";
};

export function IconButton({
  label,
  children,
  className,
  variant = "ghost",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 lg:size-10 items-center justify-center rounded-control text-fg-muted transition-colors hover:text-fg disabled:pointer-events-none disabled:opacity-50",
        variant === "ghost" ? "hover:bg-surface" : "bg-surface hover:bg-surface-hover",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
