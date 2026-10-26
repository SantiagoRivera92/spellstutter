/**
 * Curated mapping from this app's heuristic archetype slugs (`ARCHETYPE_RULES`)
 * to endstep.cc archetype slugs.
 *
 * endstep uses its own taxonomy with namespaced, hashed slugs
 * (`mono-red-rally-1968ddae`), so there is no automatic join key between the
 * two. Only the mappings we are confident about are listed here; an unmapped
 * slug falls back to the MTGO record. endstep also lumps some variants together
 * (every Affinity color points at the same endstep archetype), so several
 * rules can share one endstep slug.
 *
 * When endstep reshuffles its buckets, re-check the target with:
 *   pnpm sync:endstep -- --dry-run
 * and the archetype list in `endstep_archetypes`.
 */
export const ENDSTEP_ARCHETYPE_BY_RULE: Record<string, string> = {
  // Affinity (endstep keeps a single Affinity bucket plus Azorius).
  "affinity-esper": "affinity-e93f5f74",
  "affinity-grixis": "affinity-e93f5f74",
  "affinity-jeskai": "affinity-e93f5f74",
  "affinity-mono-u": "affinity-e93f5f74",
  "affinity-4c": "affinity-e93f5f74",
  affinity: "affinity-e93f5f74",

  "wildfire-jund": "jund-wildfire-b1e6f661",

  // Mono-red aggro family (endstep folds Rally / Goblins / RDW together).
  "mono-red-synthesizer": "mono-red-rally-1968ddae",
  goblins: "mono-red-rally-1968ddae",
  rdw: "mono-red-rally-1968ddae",
  "mono-red-blitz": "hot-dogs-0ebb3662",

  // Blue tempo / control.
  "mono-blue-terror": "blue-terror-9eb65470",
  delver: "blue-terror-9eb65470",
  "izzet-terror": "izzet-control-55e8bd26",
  "izzet-skred": "izzet-control-55e8bd26",
  "ub-control": "dimir-control-2932dde7",

  // Faeries.
  "dimir-faeries": "dimir-faeries-92f62264",
  "mono-blue-faeries": "mono-blue-faeries-13c7c14c",
  "azorius-faeries": "azorius-faeries-66ae89f7",

  // Madness.
  "monored-madness": "mono-red-madness-60596e8a",
  "rakdos-madness": "rakdos-madness-4ab66652",

  // Artifact / synthesizer shells.
  boros: "boros-mardu-synth-synthless-4c9eff28",

  // White aggro.
  "white-weenie": "white-aggro-a87cb450",
  "naya-bully": "boros-bully-95094759",

  // Combo.
  "daru-combo": "abzan-daru-spiritualist-991b5b81",
  "turbo-initiative": "naya-initiative-b7d76b93",
  "inside-out": "tireless-tribe-combo-ded4ace5",
  "persistent-petitioners": "simic-petitioners-mill-f1fd064e",
  "poison-storm": "poison-storm-cc380b39",
  storm: "ruby-storm-ea6f23b6",
  "cycle-storm": "cycle-storm-87737aed",
  reanimator: "sultai-dark-ritual-1ddf92c8",
  "elves-spy-combo": "spy-combo-e2ef67cd",
  "wall-spy-combo": "spy-combo-e2ef67cd",
  "spy-combo": "spy-combo-e2ef67cd",

  // Midrange / control.
  tron: "monster-tron-1bc68613",
  "golgari-gardens": "gardens-4ad158da",
  "mono-black-gardens": "gardens-4ad158da",
  "jund-gardens": "gardens-4ad158da",
  "mono-black": "mono-black-control-945835b3",
  "mono-black-devotion": "mono-black-devotion-69d9769f",
  "mono-black-sacrifice": "mono-black-sac-8343aa06",
  "gruul-eldrazi": "gruul-impact-tremors-05b2237f",
  ponza: "gruul-ponza-4f573515",

  // Ephemerate.
  "ephemerate-jeskai": "jeskai-ephemerate-e779a170",
  "ephemerate-esper": "esper-ephemerate-51d20386",

  // Aggro / tempo.
  bogles: "bogles-ebbf1ad3",
  heroic: "mono-white-heroic-513f6518",
  infect: "infect-d9ddbdea",
  elves: "elves-262fdcbd",
  "mono-green-stompy": "mono-green-stompy-4b3f15f1",
  "hot-dogs": "hot-dogs-0ebb3662",

  // Control / prison.
  familiars: "familiars-7f485000",
  walls: "walls-combo-97bce49c",
  "turbo-fog": "turbo-fog-1a1b6f26",

  // Gates.
  gates: "azorius-gates-894af018",
  "naya-gates": "naya-gates-af060ab8",

  // Dredge.
  dredge: "dredge-da95b296",
};

const RULE_SLUGS_BY_ENDSTEP = new Map<string, string[]>();
for (const [ruleSlug, endstepSlug] of Object.entries(ENDSTEP_ARCHETYPE_BY_RULE)) {
  const current = RULE_SLUGS_BY_ENDSTEP.get(endstepSlug) ?? [];
  current.push(ruleSlug);
  RULE_SLUGS_BY_ENDSTEP.set(endstepSlug, current);
}

/** The endstep.cc archetype slug for one of this app's archetype slugs. */
export function endstepSlugForRule(ruleSlug: string): string | null {
  return ENDSTEP_ARCHETYPE_BY_RULE[ruleSlug] ?? null;
}

/**
 * Every app archetype slug that endstep folds into one endstep slug.
 * A single result means the join is exact; more than one means the endstep
 * row is group-level and cannot be split back into app variants.
 */
export function ruleSlugsForEndstep(endstepSlug: string): string[] {
  return RULE_SLUGS_BY_ENDSTEP.get(endstepSlug) ?? [];
}
