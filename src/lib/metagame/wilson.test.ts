import { test } from "node:test";
import assert from "node:assert/strict";
import { wilsonScoreInterval } from "./wilson";

const round = (value: number) => Math.round(value * 10000) / 10000;

test("wilson interval is null when there are no decided games", () => {
  assert.equal(wilsonScoreInterval(0, 0), null);
});

test("wilson interval brackets the sample proportion for a large sample", () => {
  const interval = wilsonScoreInterval(60, 40)!;
  assert.equal(round(interval.low), 0.502);
  assert.equal(round(interval.high), 0.6906);
  assert.equal(round(interval.center), 0.5963);
});

test("wilson interval stays within [0, 1] and widens for tiny samples", () => {
  const interval = wilsonScoreInterval(1, 0)!;
  assert.equal(round(interval.low), 0.2065);
  assert.equal(interval.high, 1);
});

test("wilson interval is symmetric around 0.5 for an even split", () => {
  const interval = wilsonScoreInterval(50, 50)!;
  assert.equal(round(interval.center), 0.5);
  assert.equal(round(interval.low), 0.4038);
  assert.equal(round(interval.high), 0.5962);
});
