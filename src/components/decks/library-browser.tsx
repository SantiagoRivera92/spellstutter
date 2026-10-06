"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Folder,
  FolderInput,
  FolderPlus,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { FolderNode } from "@/lib/supabase/types";
import type { DeckSummary } from "@/lib/decks/types";
import {
  createDeck,
  createDeckFromArchetype,
  createFolder,
  deleteDeck,
  deleteFolder,
  moveFolder,
  renameFolder,
  updateDeck,
  type ActionResult,
} from "@/lib/decks/actions";
import type { ArchetypeOption } from "@/lib/metagame/types";
import { collectDescendantIds, flattenFolders } from "@/lib/decks/folders";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Field, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, MenuItem, MenuSeparator } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ColorPips } from "@/components/cards/color-pips";

type Selection = "all" | "unfiled" | string;

type DialogState =
  | { kind: "new-deck" }
  | { kind: "new-folder"; parentId: string | null }
  | { kind: "rename-folder"; folder: FolderNode }
  | { kind: "delete-folder"; folder: FolderNode }
  | { kind: "move-folder"; folder: FolderNode }
  | { kind: "move-deck"; deck: DeckSummary }
  | { kind: "delete-deck"; deck: DeckSummary }
  | { kind: "edit-deck"; deck: DeckSummary }
  | null;

export function LibraryBrowser({
  folders,
  decks,
  archetypes,
}: {
  folders: FolderNode[];
  decks: DeckSummary[];
  archetypes: ArchetypeOption[];
}) {
  const router = useRouter();
  const [selection, setSelection] = React.useState<Selection>("all");
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const flatFolders = React.useMemo(() => flattenFolders(folders), [folders]);

  const visibleDecks = React.useMemo(() => {
    if (selection === "all") return decks;
    if (selection === "unfiled")
      return decks.filter((deck) => deck.folder_id === null);
    return decks.filter((deck) => deck.folder_id === selection);
  }, [decks, selection]);

  function run(
    action: () => Promise<ActionResult>,
    onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDialog(null);
      if (onSuccess) {
        // The callback navigates away (e.g. into a new deck), so refreshing
        // the current route would be a racing second navigation.
        onSuccess(result);
      } else {
        router.refresh();
      }
    });
  }

  const selectedFolder =
    selection !== "all" && selection !== "unfiled"
      ? flattenFolders(folders).find((entry) => entry.id === selection)
      : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-medium text-muted-foreground">
            Folders
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New folder"
            onClick={() =>
              setDialog({
                kind: "new-folder",
                parentId:
                  selection !== "all" && selection !== "unfiled"
                    ? selection
                    : null,
              })
            }
          >
            <FolderPlus className="size-4" aria-hidden />
          </Button>
        </div>
        <nav aria-label="Deck folders">
          <ul className="space-y-0.5">
            <FolderButton
              label="All decks"
              count={decks.length}
              icon={<Layers className="size-4" aria-hidden />}
              active={selection === "all"}
              onClick={() => setSelection("all")}
            />
            <FolderButton
              label="Unfiled"
              count={decks.filter((deck) => deck.folder_id === null).length}
              icon={<Folder className="size-4" aria-hidden />}
              active={selection === "unfiled"}
              onClick={() => setSelection("unfiled")}
            />
          </ul>
          <ul className="mt-1 space-y-0.5">
            {folders.map((node) => (
              <FolderTree
                key={node.id}
                node={node}
                depth={0}
                selection={selection}
                onSelect={setSelection}
                onMenu={setDialog}
              />
            ))}
          </ul>
          {folders.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No folders yet. Create one to group decks by format, event, or
              brew.
            </p>
          ) : null}
        </nav>
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium">
              {selection === "all"
                ? "All decks"
                : selection === "unfiled"
                  ? "Unfiled decks"
                  : (selectedFolder?.name ?? "Folder")}
            </h2>
            <p className="text-sm text-muted-foreground numeric">
              {visibleDecks.length} deck{visibleDecks.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button onClick={() => setDialog({ kind: "new-deck" })}>
            <Plus className="size-4" aria-hidden />
            New deck
          </Button>
        </div>

        {error ? (
          <p role="alert" className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage(error)}
          </p>
        ) : null}

        {visibleDecks.length === 0 ? (
          <EmptyState
            title="No decks here yet"
            description="Create a deck and it will appear in this folder. Decks can be moved between folders at any time."
            action={
              <Button onClick={() => setDialog({ kind: "new-deck" })}>
                <Plus className="size-4" aria-hidden />
                New deck
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onMenu={setDialog}
              />
            ))}
          </ul>
        )}
      </section>

      {dialog?.kind === "new-deck" ? (
        <NewDeckDialog
          pending={pending}
          defaultFolderId={
            selection !== "all" && selection !== "unfiled" ? selection : null
          }
          folders={flatFolders}
          archetypes={archetypes}
          onClose={() => setDialog(null)}
          onSubmit={(name, folderId, archetypeSlug) =>
            run(
              () =>
                archetypeSlug
                  ? createDeckFromArchetype({ name, folderId, archetypeSlug })
                  : createDeck({ name, folderId }),
              (result) => {
                if (result.deckId) router.push(`/decks/${result.deckId}/edit`);
              },
            )
          }
        />
      ) : null}

      {dialog?.kind === "new-folder" ? (
        <NameDialog
          title="New folder"
          submitLabel="Create folder"
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(name) =>
            run(() => createFolder({ name, parentId: dialog.parentId }))
          }
        />
      ) : null}

      {dialog?.kind === "rename-folder" ? (
        <NameDialog
          key={dialog.folder.id}
          title="Rename folder"
          submitLabel="Save name"
          pending={pending}
          initialValue={dialog.folder.name}
          onClose={() => setDialog(null)}
          onSubmit={(name) =>
            run(() => renameFolder({ id: dialog.folder.id, name }))
          }
        />
      ) : null}

      {dialog?.kind === "move-folder" ? (
        <MoveFolderDialog
          folder={dialog.folder}
          folders={folders}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(parentId) =>
            run(() => moveFolder({ id: dialog.folder.id, parentId }))
          }
        />
      ) : null}

      {dialog?.kind === "move-deck" ? (
        <MoveDeckDialog
          folders={flatFolders}
          pending={pending}
          currentFolderId={dialog.deck.folder_id}
          onClose={() => setDialog(null)}
          onSubmit={(folderId) =>
            run(() => updateDeck({ id: dialog.deck.id, folderId }))
          }
        />
      ) : null}

      {dialog?.kind === "edit-deck" ? (
        <EditDeckDialog
          deck={dialog.deck}
          folders={flatFolders}
          pending={pending}
          onClose={() => setDialog(null)}
          onSubmit={(values) =>
            run(() => updateDeck({ id: dialog.deck.id, ...values }))
          }
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "delete-folder"}
        title="Delete folder?"
        pending={pending}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(() =>
            deleteFolder({
              id: dialog?.kind === "delete-folder" ? dialog.folder.id : "",
            }),
          )
        }
      >
        <p>
          Deleting{" "}
          <strong>
            {dialog?.kind === "delete-folder" ? dialog.folder.name : ""}
          </strong>{" "}
          also deletes its subfolders. Decks inside are kept and become unfiled.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === "delete-deck"}
        title="Delete deck?"
        pending={pending}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          run(() =>
            deleteDeck({
              id: dialog?.kind === "delete-deck" ? dialog.deck.id : "",
            }),
          )
        }
      >
        <p>
          <strong>
            {dialog?.kind === "delete-deck" ? dialog.deck.name : ""}
          </strong>{" "}
          and its card list will be permanently removed.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid_name":
      return "Enter a name between 1 and 120 characters.";
    case "migration_required":
      return "The database is missing the latest migration. Apply supabase/migrations/20260929120000_deck_archetype.sql and try again.";
    case "archetype_unavailable":
      return "No stored lists for that archetype yet. Run the metagame sync. ";
    case "not_found":
      return "That deck could not be found.";
    case "list_too_long":
      return "That list is too long to import (100,000 characters max).";
    case "card_catalog_unavailable":
      return "The card catalog is unavailable right now. Try again shortly.";
    case "empty_list":
      return "No cards were recognised in that list.";
    default:
      return code;
  }
}

function FolderButton({
  label,
  count,
  icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        {icon}
        <span className="flex-1 truncate text-left">{label}</span>
        <span className="numeric text-xs text-muted-foreground">{count}</span>
      </button>
    </li>
  );
}

function FolderTree({
  node,
  depth,
  selection,
  onSelect,
  onMenu,
}: {
  node: FolderNode;
  depth: number;
  selection: Selection;
  onSelect: (id: string) => void;
  onMenu: (state: DialogState) => void;
}) {
  const active = selection === node.id;
  return (
    <li>
      <div className="group flex items-center">
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          aria-current={active ? "true" : undefined}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md py-1.5 pr-1 text-sm transition-colors duration-150",
            active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <Folder className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">{node.name}</span>
          <span className="numeric text-xs text-muted-foreground">
            {node.deck_count}
          </span>
        </button>
        <DropdownMenu
          label={`Folder actions for ${node.name}`}
          trigger={
            <span className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-muted hover:text-foreground">
              <MoreHorizontal className="size-4" aria-hidden />
            </span>
          }
        >
          <MenuItem
            onClick={() => onMenu({ kind: "new-folder", parentId: node.id })}
          >
            <FolderPlus className="size-4" aria-hidden />
            New subfolder
          </MenuItem>
          <MenuItem onClick={() => onMenu({ kind: "rename-folder", folder: node })}>
            <Pencil className="size-4" aria-hidden />
            Rename
          </MenuItem>
          <MenuItem onClick={() => onMenu({ kind: "move-folder", folder: node })}>
            <FolderInput className="size-4" aria-hidden />
            Move…
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            onClick={() => onMenu({ kind: "delete-folder", folder: node })}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </MenuItem>
        </DropdownMenu>
      </div>
      {node.children.length ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <FolderTree
              key={child.id}
              node={child}
              depth={depth + 1}
              selection={selection}
              onSelect={onSelect}
              onMenu={onMenu}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function DeckCard({
  deck,
  onMenu,
}: {
  deck: DeckSummary;
  onMenu: (state: DialogState) => void;
}) {
  return (
    <li className="group rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/50">
      <Link href={`/decks/${deck.id}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg bg-muted">
          {deck.cover_art_url ? (
            <Image
              src={deck.cover_art_url}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 320px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Layers className="size-6" aria-hidden />
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-sm font-medium">
              {deck.name}
            </h3>
            {deck.visibility !== "private" ? (
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {deck.visibility}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <ColorPips colors={deck.color_identity} size={14} label={false} />
            <span className="numeric">{deck.card_count} cards</span>
            <span className="ml-auto">{formatDate(deck.updated_at)}</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-end border-t border-border px-2 py-1.5">
        <DropdownMenu
          label={`Deck actions for ${deck.name}`}
          trigger={
            <span className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <MoreHorizontal className="size-4" aria-hidden />
            </span>
          }
        >
          <MenuItem onClick={() => onMenu({ kind: "edit-deck", deck })}>
            <Pencil className="size-4" aria-hidden />
            Details
          </MenuItem>
          <MenuItem onClick={() => onMenu({ kind: "move-deck", deck })}>
            <FolderInput className="size-4" aria-hidden />
            Move to folder…
          </MenuItem>
          <MenuSeparator />
          <MenuItem destructive onClick={() => onMenu({ kind: "delete-deck", deck })}>
            <Trash2 className="size-4" aria-hidden />
            Delete
          </MenuItem>
        </DropdownMenu>
      </div>
    </li>
  );
}

function NewDeckDialog({
  pending,
  defaultFolderId,
  folders,
  archetypes,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  defaultFolderId: string | null;
  folders: { id: string; name: string; depth: number }[];
  archetypes: ArchetypeOption[];
  onClose: () => void;
  onSubmit: (
    name: string,
    folderId: string | null,
    archetypeSlug: string | null,
  ) => void;
}) {
  const [name, setName] = React.useState("");
  const [folderId, setFolderId] = React.useState(defaultFolderId ?? "");
  const [mode, setMode] = React.useState<"brew" | "archetype">("brew");
  const [archetypeSlug, setArchetypeSlug] = React.useState(
    archetypes[0]?.slug ?? "",
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="New deck"
      description="Start from scratch, or seed the list with an archetype's core cards."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSubmit(
            name.trim(),
            folderId || null,
            mode === "archetype" && archetypeSlug ? archetypeSlug : null,
          );
        }}
      >
        <Field label="Deck name" htmlFor="new-deck-name">
          <Input
            id="new-deck-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            autoFocus
            required
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Starting point</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors duration-150",
                mode === "brew" ? "border-primary" : "border-border hover:border-primary/40",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="new-deck-mode"
                  value="brew"
                  checked={mode === "brew"}
                  onChange={() => setMode("brew")}
                  className="accent-[var(--primary)]"
                />
                Brew from scratch
              </span>
              <span className="text-xs text-muted-foreground">
                Start with an empty list.
              </span>
            </label>
            <label
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors duration-150",
                mode === "archetype" ? "border-primary" : "border-border hover:border-primary/40",
                !archetypes.length && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="new-deck-mode"
                  value="archetype"
                  checked={mode === "archetype"}
                  disabled={!archetypes.length}
                  onChange={() => setMode("archetype")}
                  className="accent-[var(--primary)]"
                />
                Seed an archetype
              </span>
              <span className="text-xs text-muted-foreground">
                Adds the core cards every list runs.
              </span>
            </label>
          </div>
        </fieldset>

        {mode === "archetype" ? (
          <Field
            label="Archetype"
            htmlFor="new-deck-archetype"
            description="Based on the last 120 days of MTGO results."
          >
            <Select
              id="new-deck-archetype"
              value={archetypeSlug}
              onChange={(event) => setArchetypeSlug(event.target.value)}
            >
              {archetypes.map((archetype) => (
                <option key={archetype.slug} value={archetype.slug}>
                  {archetype.name} ({archetype.decks})
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Folder" htmlFor="new-deck-folder" optional>
          <Select
            id="new-deck-folder"
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
          >
            <option value="">Unfiled</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {"\u00A0\u00A0".repeat(folder.depth)}
                {folder.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              pending ||
              !name.trim() ||
              (mode === "archetype" && !archetypeSlug)
            }
          >
            {pending ? "Creating…" : "Create deck"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function NameDialog({
  title,
  submitLabel,
  pending,
  initialValue = "",
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  pending: boolean;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = React.useState(initialValue);

  return (
    <Dialog open onClose={onClose} title={title}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onSubmit(name.trim());
        }}
      >
        <Field label="Folder name" htmlFor="folder-name">
          <Input
            id="folder-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoFocus
            required
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function MoveFolderDialog({
  folder,
  folders,
  pending,
  onClose,
  onSubmit,
}: {
  folder: FolderNode;
  folders: FolderNode[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (parentId: string | null) => void;
}) {
  const [parentId, setParentId] = React.useState("");
  const blocked = new Set(collectDescendantIds(folder));
  const options = flattenFolders(folders).filter((entry) => !blocked.has(entry.id));

  return (
    <Dialog open onClose={onClose} title="Move folder" description="Pick a new parent. Root means no parent.">
      <div className="space-y-4">
        <Field label="Destination" htmlFor="move-folder-target">
          <Select
            id="move-folder-target"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Root (no parent)</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {"\u00A0\u00A0".repeat(option.depth)}
                {option.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => onSubmit(parentId || null)}
          >
            {pending ? "Moving…" : "Move folder"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function MoveDeckDialog({
  folders,
  currentFolderId,
  pending,
  onClose,
  onSubmit,
}: {
  folders: { id: string; name: string; depth: number }[];
  currentFolderId: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (folderId: string | null) => void;
}) {
  const [folderId, setFolderId] = React.useState(currentFolderId ?? "");

  return (
    <Dialog open onClose={onClose} title="Move deck">
      <div className="space-y-4">
        <Field label="Folder" htmlFor="move-deck-target">
          <Select
            id="move-deck-target"
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
          >
            <option value="">Unfiled</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {"\u00A0\u00A0".repeat(folder.depth)}
                {folder.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => onSubmit(folderId || null)}>
            {pending ? "Moving…" : "Move deck"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EditDeckDialog({
  deck,
  folders,
  pending,
  onClose,
  onSubmit,
}: {
  deck: DeckSummary;
  folders: { id: string; name: string; depth: number }[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    description: string;
    visibility: "private" | "unlisted" | "public";
    folderId: string | null;
  }) => void;
}) {
  const [name, setName] = React.useState(deck.name);
  const [description, setDescription] = React.useState(deck.description ?? "");
  const [visibility, setVisibility] = React.useState<"private" | "unlisted" | "public">(
    deck.visibility,
  );
  const [folderId, setFolderId] = React.useState(deck.folder_id ?? "");

  return (
    <Dialog open onClose={onClose} title="Deck details">
      <div className="space-y-4">
        <Field label="Name" htmlFor="edit-deck-name">
          <Input
            id="edit-deck-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Description" htmlFor="edit-deck-description" optional>
          <Textarea
            id="edit-deck-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            rows={3}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility" htmlFor="edit-deck-visibility">
            <Select
              id="edit-deck-visibility"
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as typeof visibility)
              }
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted (link only)</option>
              <option value="public">Public (on your profile)</option>
            </Select>
          </Field>
          <Field label="Folder" htmlFor="edit-deck-folder" optional>
            <Select
              id="edit-deck-folder"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
            >
              <option value="">Unfiled</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {"\u00A0\u00A0".repeat(folder.depth)}
                  {folder.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                description,
                visibility,
                folderId: folderId || null,
              })
            }
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  title,
  pending,
  onClose,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">{children}</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
