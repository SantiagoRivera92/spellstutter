import { test } from "node:test";
import assert from "node:assert/strict";
import { METAGAME_WINDOWS, parseMetagameWindow } from "./windows";

test("parseMetagameWindow accepts every supported window", () => {
  for (const window of METAGAME_WINDOWS) {
    assert.equal(parseMetagameWindow(String(window)), window);
  }
});

test("parseMetagameWindow defaults to 30 for missing or unsupported values", () => {
  assert.equal(parseMetagameWindow(undefined), 30);
  assert.equal(parseMetagameWindow(""), 30);
  assert.equal(parseMetagameWindow("0"), 30);
  assert.equal(parseMetagameWindow("365"), 30);
  assert.equal(parseMetagameWindow("nope"), 30);
});

test("parseMetagameWindow parses leading integers", () => {
  assert.equal(parseMetagameWindow("14abc"), 14);
  assert.equal(parseMetagameWindow(" 7 "), 7);
});
