"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { DeckCommentView } from "@/lib/supabase/types";
import { addDeckComment, deleteDeckComment } from "@/lib/decks/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";

export function CommentSection({
  deckId,
  comments,
  canComment,
  currentUserId,
}: {
  deckId: string;
  comments: DeckCommentView[];
  canComment: boolean;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const total = countComments(comments);

  function submit(body: string, parentId: string | null, reset: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await addDeckComment({ deckId, body, parentId });
      if (result.ok) {
        reset();
        router.refresh();
      } else {
        setError(commentError(result.error));
      }
    });
  }

  function remove(commentId: string) {
    startTransition(async () => {
      await deleteDeckComment({ commentId, deckId });
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-10 border-t border-border pt-6">
      <h2
        id="comments-heading"
        className="font-display text-lg font-medium"
      >
        Comments <span className="numeric text-sm text-muted-foreground">{total}</span>
      </h2>

      {canComment ? (
        <CommentForm
          label="Post a comment"
          pending={pending}
          onSubmit={(body, reset) => submit(body, null, reset)}
        />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {comments.length ? (
        <ul className="mt-5 space-y-5">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              canComment={canComment}
              pending={pending}
              onReply={(body, reset) => submit(body, comment.id, reset)}
              onDelete={remove}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No comments yet — be the first.
        </p>
      )}
    </section>
  );
}

function CommentItem({
  comment,
  currentUserId,
  canComment,
  pending,
  onReply,
  onDelete,
}: {
  comment: DeckCommentView;
  currentUserId: string | null;
  canComment: boolean;
  pending: boolean;
  onReply: (body: string, reset: () => void) => void;
  onDelete: (commentId: string) => void;
}) {
  const [replying, setReplying] = React.useState(false);
  const name = comment.author?.display_name ?? comment.author?.username ?? "Player";

  return (
    <li id={`comment-${comment.id}`}>
      <div className="flex gap-3">
        <Avatar src={comment.author?.avatar_art_url} name={name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            {comment.author ? (
              <>
                <Link
                  href={`/users/${comment.author.username}`}
                  className="font-medium hover:text-primary"
                >
                  {name}
                </Link>
                <Link
                  href={`/users/${comment.author.username}`}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  @{comment.author.username}
                </Link>
              </>
            ) : (
              <span className="font-medium">{name}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(comment.created_at)}
            </span>
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
            {comment.body}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs">
            {canComment ? (
              <button
                type="button"
                onClick={() => setReplying((value) => !value)}
                className="text-muted-foreground hover:text-foreground"
              >
                Reply
              </button>
            ) : null}
            {currentUserId === comment.user_id ? (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" aria-hidden />
                Delete
              </button>
            ) : null}
          </div>

          {replying ? (
            <CommentForm
              label="Post a reply"
              pending={pending}
              onCancel={() => setReplying(false)}
              onSubmit={(body, reset) => onReply(body, reset)}
            />
          ) : null}

          {comment.replies.length ? (
            <ul className="mt-4 space-y-4 border-l border-border pl-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  canComment={canComment}
                  pending={pending}
                  onReply={onReply}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function CommentForm({
  label,
  pending,
  onSubmit,
  onCancel,
}: {
  label: string;
  pending: boolean;
  onSubmit: (body: string, reset: () => void) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = React.useState("");

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) return;
        onSubmit(body, () => setBody(""));
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Share your thoughts on this deck…"
        aria-label={label}
      />
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? "Posting…" : label}
        </Button>
      </div>
    </form>
  );
}

function commentError(code: string): string {
  if (code === "unauthenticated") return "Sign in to comment.";
  if (code === "not_found") return "This deck is not available for comments.";
  if (/row-level security|violates .*constraint/i.test(code)) {
    return "You can only comment on public or unlisted decks.";
  }
  if (/does not exist|schema cache/i.test(code)) {
    return "Comments are not set up on this database yet — apply the latest migration.";
  }
  return "Could not post your comment.";
}

function countComments(comments: DeckCommentView[]): number {
  return comments.reduce(
    (sum, comment) => sum + 1 + countComments(comment.replies),
    0,
  );
}
