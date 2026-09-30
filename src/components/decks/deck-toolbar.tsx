"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  FolderInput,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import type { DeckCardView, DeckVisibility } from "@/lib/decks/types";
import {
  cloneUserDeck,
  deleteDeck,
  importDecklist,
  setDeckCover,
  updateDeck,
  type ActionResult,
} from "@/lib/decks/actions";
import { deckToMtgoDek, deckToText } from "@/lib/decks/export";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  DropdownMenu,
  MenuItem,
  MenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Folder } from "@/lib/supabase/types";

interface DeckToolbarProps {
  deckId: string;
  deckName: string;
  coverOracleId: string | null;
  folderId: string | null;
  folders: Folder[];
  cards: DeckCardView[];
  canEdit: boolean;
}

export function DeckToolbar({
  deckId,
  deckName,
  coverOracleId,
  folderId,
  folders,
  cards,
  canEdit,
}: DeckToolbarProps) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<
    "cover" | "import" | "export" | "delete" | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [nameValue, setNameValue] = React.useState(deckName);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [targetFolder, setTargetFolder] = React.useState(folderId ?? "");

  function run(
    action: () => Promise<ActionResult>,
    options?: { onSuccess?: () => void; refresh?: boolean },
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDialog(null);
      if (options?.onSuccess) options.onSuccess();
      else if (options?.refresh !== false) router.refresh();
    });
  }

  const coverCandidates = React.useMemo(
    () => cards.filter((card) => card.art_crop && card.board === "main"),
    [cards],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Link href={`/decks/${deckId}/edit`} className={buttonVariants({})}>
          <Pencil className="size-4" aria-hidden />
          Edit deck
        </Link>
      ) : (
        <Button
          disabled={pending}
          onClick={() =>
            run(
              async () => {
                const result = await cloneUserDeck({ deckId });
                if (result.ok && result.deckId) {
                  router.push(`/decks/${result.deckId}/edit`);
                } else if (!result.ok && result.error === "unauthenticated") {
                  router.push(
                    `/login?next=${encodeURIComponent(`/decks/${deckId}`)}`,
                  );
                }
                return result;
              },
              { refresh: false },
            )
          }
        >
          <Copy className="size-4" aria-hidden />
          {pending ? "Cloning…" : "Clone deck"}
        </Button>
      )}
      <Button variant="outline" onClick={() => setDialog("export")}>
        <Download className="size-4" aria-hidden />
        Export
      </Button>
      {canEdit ? (
        <>
          <Button variant="outline" onClick={() => setDialog("import")}>
            <Upload className="size-4" aria-hidden />
            Import
          </Button>
          <Button variant="outline" onClick={() => setDialog("cover")}>
            <ImageIcon className="size-4" aria-hidden />
            Cover
          </Button>
          <DropdownMenu
            label="More deck actions"
            trigger={
              <span
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "px-0",
                )}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </span>
            }
          >
            <MenuItem
              onClick={() => {
                setNameValue(deckName);
                setRenameOpen(true);
              }}
            >
              <Pencil className="size-4" aria-hidden />
              Rename
            </MenuItem>
            <MenuItem
              onClick={() => {
                setTargetFolder(folderId ?? "");
                setMoveOpen(true);
              }}
            >
              <FolderInput className="size-4" aria-hidden />
              Move to folder…
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => setDialog("delete")} destructive>
              <Trash2 className="size-4" aria-hidden />
              Delete deck
            </MenuItem>
          </DropdownMenu>
        </>
      ) : null}

      {error && !dialog ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Dialog
        open={dialog === "cover"}
        onClose={() => setDialog(null)}
        title="Cover card"
        description="Pick the card art shown on your deck tiles."
        className="w-[min(44rem,calc(100vw-2rem))]"
      >
        <div className="space-y-4">
          <ul className="grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {coverCandidates.map((card) => {
              const active = card.oracle_id === coverOracleId;
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setDeckCover({
                          deckId,
                          oracleId: card.oracle_id,
                          artUrl: card.art_crop,
                        }),
                      )
                    }
                    className={cn(
                      "group w-full overflow-hidden rounded-lg border text-left transition-colors duration-150",
                      active
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="relative block aspect-[16/9] bg-muted">
                      {card.art_crop ? (
                        <Image
                          src={card.art_crop}
                          alt=""
                          fill
                          sizes="200px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                      {active ? (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                          <Check className="size-3" aria-hidden />
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate px-2 py-1.5 text-xs">
                      {card.card_name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {coverOracleId ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setDeckCover({ deckId, oracleId: null, artUrl: null }),
                )
              }
            >
              Clear cover
            </Button>
          ) : null}
        </div>
      </Dialog>

      {dialog === "import" ? (
        <ImportDialog
          pending={pending}
          error={error}
          onClose={() => setDialog(null)}
          onSubmit={(text, mode, board) =>
            run(() => importDecklist({ deckId, text, mode, board }))
          }
        />
      ) : null}

      {dialog === "export" ? (
        <ExportDialog
          deckName={deckName}
          cards={cards}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Delete deck?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{deckName}</strong> and its card
            list will be permanently removed.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(() => deleteDeck({ id: deckId, redirectTo: "/decks" }), {
                  refresh: false,
                })
              }
            >
              {pending ? "Deleting…" : "Delete deck"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename deck"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nameValue.trim()) return;
            run(() => updateDeck({ id: deckId, name: nameValue.trim() }), {
              onSuccess: () => setRenameOpen(false),
            });
          }}
        >
          <Field label="Deck name" htmlFor="rename-deck">
            <Input
              id="rename-deck"
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              maxLength={120}
              autoFocus
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !nameValue.trim()}>
              {pending ? "Saving…" : "Save name"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move to folder"
      >
        <div className="space-y-4">
          <Field label="Folder" htmlFor="move-deck-folder" optional>
            <Select
              id="move-deck-folder"
              value={targetFolder}
              onChange={(event) => setTargetFolder(event.target.value)}
            >
              <option value="">Unfiled</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </Field>
          {folders.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              You have no folders yet. Create one from the My decks page.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updateDeck({
                      id: deckId,
                      folderId: targetFolder || null,
                    }),
                  { onSuccess: () => setMoveOpen(false) },
                )
              }
            >
              {pending ? "Moving…" : "Move deck"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ImportDialog({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (
    text: string,
    mode: "add" | "replace",
    board: "main" | "side",
  ) => void;
}) {
  const [text, setText] = React.useState("");
  const [mode, setMode] = React.useState<"add" | "replace">("replace");
  const [board, setBoard] = React.useState<"main" | "side">("main");

  return (
    <Dialog
      open
      onClose={onClose}
      title="Import a decklist"
      description="One card per line, like “4 Lightning Bolt”. A “Sideboard” header switches the target board."
    >
      <div className="space-y-4">
        <Field label="Decklist" htmlFor="import-text">
          <Textarea
            id="import-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={9}
            placeholder={"4 Lightning Bolt\n4 Counterspell\n\nSideboard\n2 Hydroblast"}
            className="font-mono text-xs"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Target board" htmlFor="import-board">
            <Select
              id="import-board"
              value={board}
              onChange={(event) => setBoard(event.target.value as typeof board)}
            >
              <option value="main">Main deck</option>
              <option value="side">Sideboard</option>
            </Select>
          </Field>
          <Field label="Mode" htmlFor="import-mode">
            <Select
              id="import-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="replace">Replace existing cards</option>
              <option value="add">Add to existing cards</option>
            </Select>
          </Field>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error === "empty_list"
              ? "No card lines were found in that text."
              : error === "card_catalog_unavailable"
                ? "The card catalog is unavailable, so imports cannot be validated."
                : error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !text.trim()}
            onClick={() => onSubmit(text, mode, board)}
          >
            {pending ? "Importing…" : "Import cards"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ExportDialog({
  deckName,
  cards,
  onClose,
}: {
  deckName: string;
  cards: DeckCardView[];
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const text = React.useMemo(() => deckToText(cards), [cards]);
  const dek = React.useMemo(() => deckToMtgoDek(cards), [cards]);

  const safeName = deckName.replace(/[^a-z0-9-_ ]/gi, "") || "deck";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download(content: string, extension: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Export decklist"
      description="Plain text, grouped by card type."
      className="w-[min(38rem,calc(100vw-2rem))]"
    >
      <div className="space-y-4">
        <Textarea readOnly value={text} rows={12} className="font-mono text-xs" />
        {dek.missing.length ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {dek.missing.length} card
            {dek.missing.length === 1 ? "" : "s"} cannot be in an MTGO file (no
            Magic Online printing) and will be left out:{" "}
            {dek.missing.join(", ")}.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => download(text, "txt", "text/plain")}
          >
            <Download className="size-4" aria-hidden />
            Download .txt
          </Button>
          <Button
            variant="outline"
            disabled={cards.length > 0 && dek.missing.length === cards.length}
            onClick={() =>
              download(dek.text, "dek", "application/octet-stream")
            }
          >
            <Download className="size-4" aria-hidden />
            Export as MTGO .dek
          </Button>
          <Button onClick={copy}>
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? "Copied" : "Copy list"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function VisibilityControl({
  deckId,
  visibility,
}: {
  deckId: string;
  visibility: DeckVisibility;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState(visibility);

  return (
    <Select
      aria-label="Deck visibility"
      value={value}
      disabled={pending}
      className="h-8 w-auto text-xs"
      onChange={(event) => {
        const next = event.target.value as DeckVisibility;
        setValue(next);
        startTransition(async () => {
          await updateDeck({ id: deckId, visibility: next });
          router.refresh();
        });
      }}
    >
      <option value="private">Private</option>
      <option value="unlisted">Unlisted</option>
      <option value="public">Public</option>
    </Select>
  );
}
