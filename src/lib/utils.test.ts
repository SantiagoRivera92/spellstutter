import { test } from "node:test";
import assert from "node:assert/strict";
import { cn, formatDate, formatUsd, ordinal } from "./utils";

test("cn merges conflicting Tailwind classes", () => {
  assert.equal(cn("p-2", "p-4"), "p-4");
  assert.equal(cn("text-sm", false && "hidden", "font-bold"), "text-sm font-bold");
  assert.equal(cn(), "");
});

test("formatUsd formats currency and handles missing values", () => {
  assert.equal(formatUsd(0), "$0.00");
  assert.equal(formatUsd(12.5), "$12.50");
  assert.equal(formatUsd(-3.25), "-$3.25");
  assert.equal(formatUsd(null), "—");
  assert.equal(formatUsd(undefined), "—");
  assert.equal(formatUsd(Number.NaN), "—");
});

test("formatDate formats dates", () => {
  assert.equal(formatDate(new Date(2026, 9, 26)), "Oct 26, 2026");
  assert.equal(formatDate(new Date(2026, 0, 1)), "Jan 1, 2026");
});

test("ordinal handles teens and suffix exceptions", () => {
  const cases: [number, string][] = [
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [10, "10th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
    [112, "112th"],
    [113, "113th"],
    [0, "0th"],
    [-1, "-1th"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(ordinal(value), expected);
  }
});
