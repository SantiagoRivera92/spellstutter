import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { rateLimitResponse } from "./rate-limit";

function request(forwardedFor?: string): NextRequest {
  const headers = new Headers();
  if (forwardedFor !== undefined) {
    headers.set("x-forwarded-for", forwardedFor);
  }
  return { headers } as NextRequest;
}

test("allows requests up to the limit then returns 429", async () => {
  const bucket = `test-${randomUUID()}`;
  assert.equal(rateLimitResponse(request("1.1.1.1"), bucket, 2), null);
  assert.equal(rateLimitResponse(request("1.1.1.1"), bucket, 2), null);

  const response = rateLimitResponse(request("1.1.1.1"), bucket, 2);
  assert.ok(response);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.deepEqual(await response.json(), {
    error: "rate_limited",
    message: "Too many requests. Please slow down.",
  });
});

test("uses the first x-forwarded-for address", () => {
  const bucket = `test-${randomUUID()}`;
  assert.equal(rateLimitResponse(request("1.1.1.1, 2.2.2.2"), bucket, 1), null);
  assert.equal(rateLimitResponse(request("1.1.1.1"), bucket, 1)?.status, 429);
  assert.equal(rateLimitResponse(request("2.2.2.2"), bucket, 1), null);
});

test("separate IPs have separate budgets", () => {
  const bucket = `test-${randomUUID()}`;
  assert.equal(rateLimitResponse(request("3.3.3.3"), bucket, 1), null);
  assert.equal(rateLimitResponse(request("3.3.3.3"), bucket, 1)?.status, 429);
  assert.equal(rateLimitResponse(request("4.4.4.4"), bucket, 1), null);
});

test("missing x-forwarded-for uses the unknown bucket", () => {
  const bucket = `test-${randomUUID()}`;
  assert.equal(rateLimitResponse(request(), bucket, 1), null);
  assert.equal(rateLimitResponse(request(), bucket, 1)?.status, 429);
});

test("supports a custom window", async () => {
  const bucket = `test-${randomUUID()}`;
  assert.equal(rateLimitResponse(request("6.6.6.6"), bucket, 1, 10), null);
  assert.equal(rateLimitResponse(request("6.6.6.6"), bucket, 1, 10)?.status, 429);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(rateLimitResponse(request("6.6.6.6"), bucket, 1, 10), null);
});
