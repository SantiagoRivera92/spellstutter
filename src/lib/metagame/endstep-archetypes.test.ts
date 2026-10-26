import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENDSTEP_ARCHETYPE_BY_RULE,
  endstepSlugForRule,
} from "./endstep-archetypes";

test("maps known rule slugs to endstep slugs", () => {
  assert.equal(endstepSlugForRule("dimir-faeries"), "dimir-faeries-92f62264");
  assert.equal(endstepSlugForRule("golgari-gardens"), "gardens-4ad158da");
  assert.equal(endstepSlugForRule("mono-blue-terror"), "blue-terror-9eb65470");
});

test("folds Affinity variants onto the shared endstep bucket", () => {
  const variants = [
    "affinity-esper",
    "affinity-grixis",
    "affinity-jeskai",
    "affinity-mono-u",
    "affinity-4c",
    "affinity",
  ];
  for (const variant of variants) {
    assert.equal(endstepSlugForRule(variant), "affinity-e93f5f74");
  }
});

test("folds spy-combo variants onto the shared endstep bucket", () => {
  for (const variant of ["elves-spy-combo", "wall-spy-combo", "spy-combo"]) {
    assert.equal(endstepSlugForRule(variant), "spy-combo-e2ef67cd");
  }
});

test("returns null for unmapped or empty slugs", () => {
  assert.equal(endstepSlugForRule("not-a-real-archetype"), null);
  assert.equal(endstepSlugForRule(""), null);
});

test("every mapping target is a non-empty namespaced slug", () => {
  for (const [rule, target] of Object.entries(ENDSTEP_ARCHETYPE_BY_RULE)) {
    assert.ok(rule.length > 0);
    assert.match(target, /^[a-z0-9-]+-[0-9a-f]{8}$/);
  }
});
