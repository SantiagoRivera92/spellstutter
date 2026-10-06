import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./redirect";

test("allows ordinary same-origin paths", () => {
  assert.equal(safeNextPath("/decks"), "/decks");
  assert.equal(safeNextPath("/decks/abc?x=1"), "/decks/abc?x=1");
});

test("rejects protocol-relative and backslash variants", () => {
  assert.equal(safeNextPath("//evil.com"), "/decks");
  assert.equal(safeNextPath("/\\evil.com"), "/decks");
  assert.equal(safeNextPath("\\evil.com"), "/decks");
});

test("rejects percent-encoded backslashes", () => {
  assert.equal(safeNextPath("/%5cevil.com"), "/decks");
  assert.equal(safeNextPath("/foo%5Cbar"), "/decks");
});

test("rejects absolute URLs", () => {
  assert.equal(safeNextPath("http://evil.com"), "/decks");
  assert.equal(safeNextPath("https://evil.com/x"), "/decks");
});

test("rejects control characters", () => {
  assert.equal(safeNextPath("/decks\u0000"), "/decks");
  assert.equal(safeNextPath("/decks\u001f"), "/decks");
});

test("falls back for empty or malformed input", () => {
  assert.equal(safeNextPath(""), "/decks");
  assert.equal(safeNextPath(null), "/decks");
  assert.equal(safeNextPath(undefined), "/decks");
});

test("double-encoded slashes resolve to a harmless relative path", () => {
  const result = safeNextPath("/%252F%252Fevil.com");
  assert.ok(result.startsWith("/"));
  assert.ok(!result.startsWith("//"));
});
