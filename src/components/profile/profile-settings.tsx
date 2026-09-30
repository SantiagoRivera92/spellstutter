"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { CardSearchResult } from "@/lib/cards/types";
import type { Profile } from "@/lib/supabase/types";
import { setProfileAvatar, updateProfile } from "@/lib/profile/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { CardSearch } from "@/components/cards/card-search";

export function ProfileSettings({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = React.useState(
    profile.display_name ?? profile.username,
  );
  const [bio, setBio] = React.useState(profile.bio ?? "");
  const [isPublic, setIsPublic] = React.useState(profile.is_public);
  const [status, setStatus] = React.useState<"idle" | "saved" | "error">("idle");
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_art_url);
  const [avatarName, setAvatarName] = React.useState(profile.avatar_card_name);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateProfile({ displayName, bio, isPublic });
      if (result.ok) {
        setStatus("saved");
        router.refresh();
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setStatus("error");
      }
    });
  }

  function chooseAvatar(card: CardSearchResult) {
    startTransition(async () => {
      const art = card.art_crop;
      const result = await setProfileAvatar({
        oracleId: card.oracle_id,
        cardName: card.name,
        artUrl: art,
      });
      if (result.ok) {
        setAvatarUrl(art);
        setAvatarName(card.name);
        setPickerOpen(false);
        router.refresh();
      }
    });
  }

  function clearAvatar() {
    startTransition(async () => {
      const result = await setProfileAvatar({
        oracleId: null,
        cardName: null,
        artUrl: null,
      });
      if (result.ok) {
        setAvatarUrl(null);
        setAvatarName(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid max-w-4xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-base font-medium">Profile</h2>
          <div className="mt-4 space-y-4">
            <Field label="Username" htmlFor="profile-username" description="Usernames are permanent for now.">
              <Input id="profile-username" value={profile.username} readOnly disabled />
            </Field>
            <Field label="Display name" htmlFor="profile-display-name">
              <Input
                id="profile-display-name"
                value={displayName}
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
            <Field label="Bio" htmlFor="profile-bio" optional>
              <Textarea
                id="profile-bio"
                value={bio ?? ""}
                maxLength={400}
                rows={3}
                onChange={(event) => setBio(event.target.value)}
              />
            </Field>
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <input
                id="profile-public"
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <label htmlFor="profile-public" className="text-sm">
                <span className="font-medium">Public profile</span>
                <span className="block text-muted-foreground">
                  Allow anyone to view your profile and public decks.
                </span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={pending || !displayName.trim()}>
                {pending ? "Saving…" : "Save profile"}
              </Button>
              {status === "saved" ? (
                <span className="inline-flex items-center gap-1 text-sm text-primary">
                  <Check className="size-4" aria-hidden />
                  Saved
                </span>
              ) : null}
              {status === "error" ? (
                <span role="alert" className="text-sm text-destructive">
                  Could not save. Try again.
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-base font-medium">Avatar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the cropped art of any Pauper-legal card.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="relative size-20 overflow-hidden rounded-full border border-border bg-muted">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <Avatar name={displayName} size={80} />
              )}
            </span>
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                Choose card art
              </Button>
              {avatarUrl ? (
                <Button variant="ghost" size="sm" onClick={clearAvatar}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          {avatarName ? (
            <p className="mt-3 text-xs text-muted-foreground">{avatarName}</p>
          ) : null}
        </section>
      </aside>

      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Pick an avatar card"
        description="Search the Pauper catalog; the cropped illustration becomes your avatar."
        className="w-[min(40rem,calc(100vw-2rem))]"
      >
        <CardSearch onSelectCard={chooseAvatar} pauperOnly autoFocus />
      </Dialog>
    </div>
  );
}
