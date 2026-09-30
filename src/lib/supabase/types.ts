export type DeckVisibility = "private" | "unlisted" | "public";
export type DeckBoard = "main" | "side" | "commander" | "maybe";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_card_oracle_id: string | null;
  avatar_card_name: string | null;
  avatar_art_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Deck {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  format: "pauper";
  visibility: DeckVisibility;
  /** Archetype the deck was seeded from, or null for a from-scratch brew. */
  archetype_slug: string | null;
  cover_oracle_id: string | null;
  cover_printing_id: string | null;
  cover_art_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeckCard {
  id: string;
  deck_id: string;
  oracle_id: string;
  printing_id: string | null;
  card_name: string;
  quantity: number;
  board: DeckBoard;
  category: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FolderNode extends Folder {
  children: FolderNode[];
  deck_count: number;
}

export interface DeckComment {
  id: string;
  deck_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface CommentAuthor {
  username: string;
  display_name: string | null;
  avatar_art_url: string | null;
}

export interface DeckCommentView extends DeckComment {
  author: CommentAuthor | null;
  replies: DeckCommentView[];
}

export type NotificationType = "deck_comment" | "comment_reply";

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  deck_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationView extends Notification {
  actor: CommentAuthor | null;
  deck_name: string | null;
  comment_body: string | null;
}
