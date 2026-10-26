import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./redirect";

test("safeNextPath defaults to /decks for missing values", () => {
  assert.equal(safeNextPath(null), "/decks");
  assert.equal(safeNextPath(undefined), "/decks");
  assert.equal(safeNextPath(""), "/decks");
});

test("safeNextPath allows absolute same-origin paths", () => {
  assert.equal(safeNextPath("/"), "/");
  assert.equal(safeNextPath("/decks/123"), "/decks/123");
  assert.equal(safeNextPath("/decks?tab=cards"), "/decks?tab=cards");
  assert.equal(safeNextPath("/decks#top"), "/decks#top");
});

test("safeNextPath rejects relative paths", () => {
  assert.equal(safeNextPath("decks"), "/decks");
  assert.equal(safeNextPath("https://example.com"), "/decks");
  assert.equal(safeNextPath("javascript:alert(1)"), "/decks");
});

test("safeNextPath rejects protocol-relative URLs", () => {
  assert.equal(safeNextPath("//evil.example"), "/decks");
  assert.equal(safeNextPath("%2F%2Fevil.example"), "/decks");
  assert.equal(safeNextPath("/%2Fevil.example"), "/decks");
});

test("safeNextPath rejects backslash variants", () => {
  assert.equal(safeNextPath("/\\evil.example"), "/decks");
  assert.equal(safeNextPath("\\evil.example"), "/decks");
  assert.equal(safeNextPath("/%5Cevil.example"), "/decks");
});

test("safeNextPath rejects control characters", () => {
  assert.equal(safeNextPath("/decks\u0000"), "/decks");
  assert.equal(safeNextPath("/decks\u001f"), "/decks");
});

test("safeNextPath rejects malformed percent encoding", () => {
  assert.equal(safeNextPath("/%E0%A4%A"), "/decks");
});

test("safeNextPath returns the original value, not the decoded one", () => {
  assert.equal(safeNextPath("/decks%20one"), "/decks%20one");
});
