import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "subtle" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // White "Upgrade" button
  primary: "bg-fg text-bg hover:bg-fg-body active:bg-fg-muted",
  // Grey "Upload" / "Record" buttons
  secondary:
    "bg-button-secondary text-button-secondary-fg hover:bg-button-secondary-hover active:bg-fg-muted",
  // Filled dark "Create a folder" action
  subtle: "bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active",
  // Text-only ("Archive" style)
  ghost: "text-fg-muted hover:bg-surface hover:text-fg active:bg-surface-active",
  danger: "bg-danger/15 text-danger hover:bg-danger/25 active:bg-danger/30",
  // Purple glow button: dark top, violet bottom, lighter edges and bottom rim
  accent:
    // Edges are inset shadows (not borders): mixed border colours leave jagged seams on rounded corners.
    "bg-linear-to-b from-accent-top to-accent-bottom text-accent-fg shadow-[inset_0_0_0_1px_rgb(70_53_110/0.85),inset_0_-1px_0_0_rgb(140_105_200/0.75),inset_0_0_10px_rgb(120_70_210/0.35),inset_0_-6px_10px_-4px_rgb(150_90_240/0.45)] [backface-visibility:hidden] hover:brightness-125 active:brightness-95 transition-[filter]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-11 rounded-control px-3 text-xs lg:h-8",
  md: "h-11 rounded-control px-4 text-sm lg:h-9",
  lg: "h-11 rounded-control px-5 text-sm",
};

export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  icon,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
