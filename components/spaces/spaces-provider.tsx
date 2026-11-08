"use client";

import { GOAL_LABEL_MAX } from "@/lib/spaces/goal";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { dayInZone } from "@/lib/dates";
import { createSpace, deleteSpace, updateSpace } from "@/lib/spaces/actions";
import type { SpaceView } from "@/lib/spaces/types";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { CreateSpaceDialog, type SpaceFormValues } from "./create-space-dialog";

type FieldErrors = Partial<Record<"name" | "goalDate" | "goalLabel" | "color", string>>;

/** Optimistic edits not yet confirmed: a partial update, or "deleted". */
type Patch = Partial<Pick<SpaceView, "name" | "goalDate" | "goalLabel" | "color">> | "deleted";
type Patches = Record<string, Patch>;

type EditTarget = Pick<SpaceView, "id" | "name" | "goalDate" | "goalLabel" | "color">;

type SpacesContextValue = {
  /** Optimistic spaces not yet confirmed by the server. */
  pending: SpaceView[];
  patches: Patches;
  openCreate: () => void;
  openEdit: (s: EditTarget) => void;
  askDelete: (s: Pick<SpaceView, "id" | "name">) => void;
};

const SpacesContext = createContext<SpacesContextValue | null>(null);

const emptyValues: SpaceFormValues = { name: "", goalDate: "", goalLabel: "", color: "BLUE" };

const browserToday = () => dayInZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

/**
 * Owns the create / edit / delete space flows with optimistic UI
 * (AGENTS.md §7). It holds no server data, so the layout stays static: lists
 * get their spaces from the server and merge `pending` and `patches` in. On
 * failure the change rolls back, an error toast shows, and the dialog
 * re-opens with what the user typed.
 */
export function SpacesProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, addPending] = useOptimistic<SpaceView[], SpaceView>([], (state, added) => [
    added,
    ...state,
  ]);
  const [patches, addPatch] = useOptimistic<Patches, { id: string; patch: Patch }>({}, (state, { id, patch }) => ({
    ...state,
    [id]: patch,
  }));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [values, setValues] = useState<SpaceFormValues>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [deleting, setDeleting] = useState<Pick<SpaceView, "id" | "name"> | null>(null);

  const openCreate = useCallback(() => {
    setEditing((e) => {
      if (e) setValues(emptyValues); // coming from an edit: start clean
      return null;
    });
    setErrors({});
    setOpen(true);
  }, []);

  const openEdit = useCallback((s: EditTarget) => {
    setEditing(s);
    setValues({ name: s.name, goalDate: s.goalDate ?? "", goalLabel: s.goalLabel ?? "", color: s.color });
    setErrors({});
    setOpen(true);
  }, []);

  const askDelete = useCallback((s: Pick<SpaceView, "id" | "name">) => setDeleting(s), []);

  const check = (v: SpaceFormValues, original?: EditTarget | null): FieldErrors | null => {
    const name = v.name.trim();
    // Quick client checks; the server validates again.
    if (!name) return { name: "Give the space a name." };
    if (name.length > 60) return { name: "Keep the name under 60 characters." };
    if (v.goalLabel.trim().length > GOAL_LABEL_MAX) return { goalLabel: `Keep the goal under ${GOAL_LABEL_MAX} characters.` };
    const unchangedDate = original && v.goalDate === (original.goalDate ?? "");
    if (v.goalDate && !unchangedDate && v.goalDate < browserToday()) {
      return { goalDate: "The goal date can't be in the past." };
    }
    return null;
  };

  const submitCreate = (v: SpaceFormValues) => {
    const name = v.name.trim();
    setOpen(false);
    startTransition(async () => {
      addPending({
        id: `pending-${Date.now()}`,
        name,
        color: v.color,
        goalDate: v.goalDate || null,
        goalLabel: v.goalLabel.trim() || null,
        documentCount: 0,
        pending: true,
      });
      try {
        const res = await createSpace({ name, goalDate: v.goalDate, goalLabel: v.goalLabel, color: v.color });
        if (res.ok) {
          setValues(emptyValues);
          setErrors({});
          toast({ tone: "success", title: "Space created", description: res.space.name });
        } else {
          setErrors(res.fieldErrors ?? {});
          setOpen(true);
          toast({
            tone: "error",
            title: "Space not created",
            description: res.formError ?? Object.values(res.fieldErrors ?? {})[0],
          });
        }
      } catch {
        // Network / server failure: the optimistic item rolls back automatically.
        setOpen(true);
        toast({ tone: "error", title: "Space not created", description: "Check your connection and try again." });
      }
    });
  };

  const submitEdit = (target: EditTarget, v: SpaceFormValues) => {
    const name = v.name.trim();
    setOpen(false);
    startTransition(async () => {
      addPatch({ id: target.id, patch: { name, goalDate: v.goalDate || null, goalLabel: v.goalLabel.trim() || null, color: v.color } });
      const fail = (description?: string, fieldErrors?: FieldErrors) => {
        setEditing(target);
        setValues(v); // never lose what they typed
        setErrors(fieldErrors ?? {});
        setOpen(true);
        toast({ tone: "error", title: "Changes not saved", description });
      };
      try {
        const res = await updateSpace({ id: target.id, name, goalDate: v.goalDate, goalLabel: v.goalLabel, color: v.color });
        if (res.ok) {
          setEditing(null);
          setValues(emptyValues);
          toast({ tone: "success", title: "Space saved", description: name });
        } else {
          fail(res.formError ?? Object.values(res.fieldErrors ?? {})[0], res.fieldErrors);
        }
      } catch {
        fail("Check your connection and try again.");
      }
    });
  };

  const submit = (v: SpaceFormValues) => {
    const problems = check(v, editing);
    if (problems) return setErrors(problems);
    if (editing) submitEdit(editing, v);
    else submitCreate(v);
  };

  const confirmDelete = (s: Pick<SpaceView, "id" | "name">) => {
    setDeleting(null);
    // Read at click time: the provider wraps the static layout, so no URL hooks here.
    const onPage = window.location.pathname.startsWith(`/spaces/${s.id}`);
    startTransition(async () => {
      addPatch({ id: s.id, patch: "deleted" });
      if (onPage) router.push("/spaces");
      try {
        const res = await deleteSpace({ id: s.id });
        if (res.ok) toast({ tone: "success", title: "Space deleted", description: s.name });
        else toast({ tone: "error", title: "Space not deleted", description: res.error });
      } catch {
        toast({ tone: "error", title: "Space not deleted", description: "Check your connection and try again." });
      }
    });
  };

  const value = useMemo(
    () => ({ pending, patches, openCreate, openEdit, askDelete }),
    [pending, patches, openCreate, openEdit, askDelete],
  );

  return (
    <SpacesContext.Provider value={value}>
      {children}
      <CreateSpaceDialog
        open={open}
        onClose={() => setOpen(false)}
        values={values}
        onChange={setValues}
        errors={errors}
        minDate={open ? browserToday() : undefined}
        onSubmit={submit}
        mode={editing ? "edit" : "create"}
      />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this Space?"
        description={
          deleting
            ? `“${deleting.name}” and all its documents, summaries, flashcards, quizzes, chat and plan will be deleted. This can't be undone.`
            : undefined
        }
        closeLabel="Cancel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deleting && confirmDelete(deleting)}>
              Delete Space
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </SpacesContext.Provider>
  );
}

export function useSpacesContext() {
  const ctx = useContext(SpacesContext);
  if (!ctx) throw new Error("useSpacesContext must be used inside <SpacesProvider>");
  return ctx;
}

function applyPatches(spaces: SpaceView[], patches: Patches): SpaceView[] {
  return spaces.flatMap((s) => {
    const p = patches[s.id];
    if (p === "deleted") return [];
    return p ? [{ ...s, ...p }] : [s];
  });
}

/** Server spaces + optimistic creates (newest first), with optimistic edits/deletes applied. */
export function useMergedSpaces(spaces: SpaceView[]) {
  const { pending, patches } = useSpacesContext();
  return useMemo(() => applyPatches([...pending, ...spaces], patches), [pending, spaces, patches]);
}

/** One space with its optimistic edit applied (null once deleted). */
export function useSpaceView<T extends EditTarget>(space: T): T | null {
  const { patches } = useSpacesContext();
  const p = patches[space.id];
  if (p === "deleted") return null;
  return p ? { ...space, ...p } : space;
}
