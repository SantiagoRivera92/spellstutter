import { test } from "node:test";
import assert from "node:assert/strict";
import {
  identityColors,
  manaValueBucket,
  parseManaCost,
  sortColors,
} from "./mana";

test("sortColors returns WUBRG order and ignores duplicates", () => {
  assert.deepEqual(sortColors(["G", "U", "W", "B", "R", "U"]), [
    "W",
    "U",
    "B",
    "R",
    "G",
  ]);
  assert.deepEqual(sortColors([]), []);
  assert.deepEqual(sortColors(["R", "W"]), ["W", "R"]);
});

test("parseManaCost returns no symbols for empty or null costs", () => {
  assert.deepEqual(parseManaCost(""), []);
  assert.deepEqual(parseManaCost(null), []);
  assert.deepEqual(parseManaCost(undefined), []);
  assert.deepEqual(parseManaCost("no symbols"), []);
});

test("parseManaCost classifies generic and colored symbols", () => {
  assert.deepEqual(parseManaCost("{2}{W}{U}"), [
    { kind: "generic", value: "2", colors: [] },
    { kind: "color", value: "W", colors: ["W"] },
    { kind: "color", value: "U", colors: ["U"] },
  ]);
});

test("parseManaCost classifies variable, colorless, and snow symbols", () => {
  assert.deepEqual(parseManaCost("{X}"), [
    { kind: "variable", value: "X", colors: [] },
  ]);
  assert.deepEqual(parseManaCost("{Y}{Z}"), [
    { kind: "variable", value: "Y", colors: [] },
    { kind: "variable", value: "Z", colors: [] },
  ]);
  assert.deepEqual(parseManaCost("{C}"), [
    { kind: "colorless", value: "C", colors: [] },
  ]);
  assert.deepEqual(parseManaCost("{S}"), [
    { kind: "snow", value: "S", colors: [] },
  ]);
});

test("parseManaCost classifies hybrid and phyrexian symbols", () => {
  assert.deepEqual(parseManaCost("{W/U}"), [
    { kind: "hybrid", value: "W/U", colors: ["W", "U"] },
  ]);
  assert.deepEqual(parseManaCost("{2/W}"), [
    { kind: "hybrid", value: "2/W", colors: ["W"] },
  ]);
  assert.deepEqual(parseManaCost("{G/P}"), [
    { kind: "phyrexian", value: "G/P", colors: ["G"] },
  ]);
});

test("parseManaCost is case-insensitive and tolerates whitespace", () => {
  assert.deepEqual(parseManaCost(" {w} {u} "), [
    { kind: "color", value: "W", colors: ["W"] },
    { kind: "color", value: "U", colors: ["U"] },
  ]);
});

test("identityColors falls back when there is no cost", () => {
  assert.deepEqual(identityColors(null, ["R"]), ["R"]);
  assert.deepEqual(identityColors("", ["R"]), ["R"]);
  assert.deepEqual(identityColors("no symbols", ["R"]), ["R"]);
});

test("identityColors ignores hybrid and phyrexian symbols", () => {
  assert.deepEqual(identityColors("{U/R}{B/P}", ["W"]), []);
  assert.deepEqual(identityColors("{1}{U/R}", ["W"]), []);
});

test("identityColors collects non-hybrid colors and de-duplicates", () => {
  assert.deepEqual(identityColors("{1}{U}{B}{U}", []), ["U", "B"]);
  assert.deepEqual(identityColors("{2}{C}{S}{X}{G}", []), ["G"]);
});

test("manaValueBucket groups mana values", () => {
  const cases: [number, string][] = [
    [-1, "1 or less"],
    [0, "1 or less"],
    [1, "1 or less"],
    [2, "2"],
    [3, "3"],
    [4, "4"],
    [5, "5"],
    [6, "6+"],
    [99, "6+"],
  ];
  for (const [value, bucket] of cases) {
    assert.equal(manaValueBucket(value), bucket);
  }
});
