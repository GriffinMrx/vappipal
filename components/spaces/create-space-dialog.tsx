"use client";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { spaceDot } from "@/components/ui/letter-chip";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import type { SpaceColor } from "@/lib/generated/prisma/enums";
import { GOAL_LABEL_MAX, GOAL_PRESETS } from "@/lib/spaces/goal";
import { spaceColorValues } from "@/lib/spaces/types";
import { useState } from "react";

export type SpaceFormValues = { name: string; goalDate: string; goalLabel: string; color: SpaceColor };

const toTokenColor = (c: SpaceColor) => c.toLowerCase() as keyof typeof spaceDot;

export function CreateSpaceDialog({
  open,
  onClose,
  values,
  onChange,
  errors,
  minDate,
  onSubmit,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  values: SpaceFormValues;
  onChange: (v: SpaceFormValues) => void;
  errors: Partial<Record<"name" | "goalDate" | "goalLabel" | "color", string>>;
  minDate?: string;
  onSubmit: (v: SpaceFormValues) => void;
  mode?: "create" | "edit";
}) {
  const edit = mode === "edit";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={edit ? "Edit Space" : "Create a Space"}
      description={edit ? "Changing the goal date rebuilds your plan." : "Group your files about one topic together."}
      closeLabel="Close"
    >
      <form
        id="create-space-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <Input
          name="space-name"
          label="Name"
          placeholder="Biology, My business plan, Cooking…"
          value={values.name}
          maxLength={80}
          autoFocus
          error={errors.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
        />
        <DatePicker
          name="space-goal-date"
          label="Goal date"
          hint={edit ? "Leave empty to remove the plan." : "Optional: an exam, a presentation, a deadline… Vappi plans each day until then."}
          min={minDate}
          value={values.goalDate}
          error={errors.goalDate}
          onChange={(goalDate) => onChange({ ...values, goalDate })}
        />
        <GoalLabelField
          value={values.goalLabel}
          error={errors.goalLabel}
          onChange={(goalLabel) => onChange({ ...values, goalLabel })}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-xs font-semibold text-fg-muted">Color</legend>
          <div className="flex flex-wrap gap-2">
            {spaceColorValues.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c.toLowerCase()}
                aria-pressed={values.color === c}
                onClick={() => onChange({ ...values, color: c })}
                className={cn(
                  "size-11 rounded-full border-2 transition-transform lg:size-8",
                  spaceDot[toTokenColor(c)],
                  values.color === c ? "scale-110 border-fg" : "border-transparent hover:scale-105",
                )}
              />
            ))}
          </div>
        </fieldset>
        <Button variant="primary" size="lg" type="submit" className="mt-2 w-full">
          {edit ? "Save" : "Create"}
        </Button>
      </form>
    </Sheet>
  );
}

const isPreset = (v: string) => (GOAL_PRESETS as readonly string[]).includes(v);

/** What the goal is: preset chips, or "Other" with a short custom label. */
function GoalLabelField({ value, error, onChange }: { value: string; error?: string; onChange: (v: string) => void }) {
  // "Other" stays selected while its text is empty.
  const [other, setOther] = useState(() => value !== "" && !isPreset(value));
  const showOther = other || (value !== "" && !isPreset(value));
  const chip = (selected: boolean) =>
    cn(
      "inline-flex h-11 items-center rounded-pill px-4 text-sm font-semibold transition-colors lg:h-9",
      selected ? "bg-surface-active text-fg" : "bg-surface text-fg-muted hover:text-fg",
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-semibold text-fg-muted">What&apos;s the goal?</legend>
      <div className="flex flex-wrap gap-2">
        {GOAL_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={!showOther && value === p}
            className={chip(!showOther && value === p)}
            onClick={() => {
              setOther(false);
              onChange(value === p ? "" : p);
            }}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={showOther}
          className={chip(showOther)}
          onClick={() => {
            setOther(!showOther);
            onChange("");
          }}
        >
          Other
        </button>
      </div>
      {showOther && (
        <Input
          name="space-goal-label"
          label="Your goal"
          placeholder="Interview, Trip, Recital…"
          value={value}
          maxLength={GOAL_LABEL_MAX}
          error={error}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {!showOther && error && <p className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}
