import { test } from "node:test";
import assert from "node:assert/strict";
import type { FolderNode } from "@/lib/supabase/types";
import { collectDescendantIds, flattenFolders } from "./folders";

function folder(
  id: string,
  name: string,
  children: FolderNode[] = [],
  parent_id: string | null = null,
): FolderNode {
  return {
    id,
    user_id: "user-1",
    parent_id,
    name,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    children,
    deck_count: 0,
  };
}

const tree = [
  folder("a", "Aggro", [folder("a1", "Burn"), folder("a2", "Delver", [folder("a2a", "Tempo")])]),
  folder("b", "Control"),
];

test("flattenFolders walks the tree depth-first", () => {
  assert.deepEqual(flattenFolders(tree), [
    { id: "a", name: "Aggro", depth: 0 },
    { id: "a1", name: "Burn", depth: 1 },
    { id: "a2", name: "Delver", depth: 1 },
    { id: "a2a", name: "Tempo", depth: 2 },
    { id: "b", name: "Control", depth: 0 },
  ]);
});

test("flattenFolders supports a custom starting depth", () => {
  assert.deepEqual(flattenFolders([tree[1]], 3), [
    { id: "b", name: "Control", depth: 3 },
  ]);
});

test("flattenFolders returns an empty array for no folders", () => {
  assert.deepEqual(flattenFolders([]), []);
});

test("collectDescendantIds includes the folder and all nested children", () => {
  assert.deepEqual(collectDescendantIds(tree[0]), ["a", "a1", "a2", "a2a"]);
});

test("collectDescendantIds returns only the folder for a leaf", () => {
  assert.deepEqual(collectDescendantIds(tree[1]), ["b"]);
});
