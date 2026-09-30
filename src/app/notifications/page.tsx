import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SetupNotice } from "@/components/setup-notice";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { getNotifications } from "@/lib/notifications/queries";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <PageHeader title="Notifications" />
        <div className="mt-6">
          <SetupNotice title="Connect Supabase" icon="key">
            <p>Notifications are stored in Postgres. Configure Supabase to continue.</p>
          </SetupNotice>
        </div>
      </div>
    );
  }

  const session = await getSession();
  if (!session) redirect("/login?next=/notifications");

  const { items, unread } = await getNotifications(50);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="Notifications"
        description={
          unread
            ? `${unread} unread notification${unread === 1 ? "" : "s"}.`
            : "Comments on your decks and replies to your comments."
        }
        actions={unread ? <MarkAllReadButton /> : undefined}
      />

      <div className="mt-6">
        {items.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {items.map((item) => {
              const name =
                item.actor?.display_name ?? item.actor?.username ?? "Someone";
              const href = item.deck_id
                ? `/decks/${item.deck_id}${item.comment_id ? `#comment-${item.comment_id}` : ""}`
                : "/decks";
              const action =
                item.type === "comment_reply"
                  ? "replied to your comment"
                  : "commented on your deck";
              return (
                <li key={item.id}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/40",
                      !item.read_at && "bg-primary/5",
                    )}
                  >
                    <Avatar
                      src={item.actor?.avatar_art_url}
                      name={name}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{name}</span> {action}
                        {item.deck_name ? (
                          <>
                            {" "}
                            <span className="font-medium">{item.deck_name}</span>
                          </>
                        ) : null}
                      </p>
                      {item.comment_body ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {item.comment_body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    {!item.read_at ? (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No notifications"
            description="When someone comments on your deck or replies to your comment, it shows up here."
          />
        )}
      </div>
    </div>
  );
}
