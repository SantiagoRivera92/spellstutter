import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./rate-limit";

test("allows up to the limit then blocks", () => {
  const key = `test-${Math.random()}`;
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), false);
  assert.equal(rateLimit(key, 2, 60_000), false);
});

test("separate keys have separate budgets", () => {
  const a = `test-a-${Math.random()}`;
  const b = `test-b-${Math.random()}`;
  assert.equal(rateLimit(a, 1, 60_000), true);
  assert.equal(rateLimit(a, 1, 60_000), false);
  assert.equal(rateLimit(b, 1, 60_000), true);
});

test("the window rolls over", async () => {
  const key = `test-w-${Math.random()}`;
  assert.equal(rateLimit(key, 1, 10), true);
  assert.equal(rateLimit(key, 1, 10), false);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(rateLimit(key, 1, 10), true);
});
