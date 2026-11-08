import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClasses =
  "h-11 w-full rounded-control lg:h-10 border border-border bg-transparent px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-fg-subtle focus:outline-none aria-invalid:border-danger disabled:opacity-50";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-fg-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        dir="auto"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClasses, className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-semibold text-fg-muted">{children}</span>;
}
