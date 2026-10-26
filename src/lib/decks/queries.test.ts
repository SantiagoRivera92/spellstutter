import { test } from "node:test";
import assert from "node:assert/strict";
import type { Folder } from "@/lib/supabase/types";
import { buildTree } from "./queries";

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "folder-1",
    user_id: "user-1",
    parent_id: null,
    name: "Folder",
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("buildTree nests folders by parent_id", () => {
  const tree = buildTree(
    [
      folder({ id: "root", name: "Root" }),
      folder({ id: "child", name: "Child", parent_id: "root" }),
      folder({ id: "grandchild", name: "Grandchild", parent_id: "child" }),
    ],
    new Map(),
  );
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "root");
  assert.equal(tree[0].children[0].id, "child");
  assert.equal(tree[0].children[0].children[0].id, "grandchild");
});

test("buildTree sorts roots and children by position then name", () => {
  const tree = buildTree(
    [
      folder({ id: "b", name: "Bravo", position: 2 }),
      folder({ id: "a", name: "Alpha", position: 2 }),
      folder({ id: "first", name: "First", position: 1 }),
      folder({ id: "child-b", name: "Bravo", parent_id: "first", position: 2 }),
      folder({ id: "child-a", name: "Alpha", parent_id: "first", position: 1 }),
    ],
    new Map(),
  );
  assert.deepEqual(
    tree.map((node) => node.id),
    ["first", "a", "b"],
  );
  assert.deepEqual(
    tree[0].children.map((node) => node.id),
    ["child-a", "child-b"],
  );
});

test("buildTree treats a folder with an unknown parent as a root", () => {
  const tree = buildTree(
    [folder({ id: "orphan", name: "Orphan", parent_id: "missing" })],
    new Map(),
  );
  assert.deepEqual(
    tree.map((node) => node.id),
    ["orphan"],
  );
});

test("buildTree attaches deck counts and defaults missing counts to zero", () => {
  const tree = buildTree(
    [
      folder({ id: "counted", name: "Counted" }),
      folder({ id: "empty", name: "Empty" }),
    ],
    new Map([["counted", 7]]),
  );
  assert.equal(tree.find((node) => node.id === "counted")?.deck_count, 7);
  assert.equal(tree.find((node) => node.id === "empty")?.deck_count, 0);
});

test("buildTree returns an empty array for no folders", () => {
  assert.deepEqual(buildTree([], new Map()), []);
});
