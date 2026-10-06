import { normalizeName } from "@/lib/cards/normalize-name";
import type { CardColor } from "@/lib/cards/types";

export const CLASSIFICATION_VERSION = "pauper-heuristics-v4";

/**
 * Cards that should not contribute to a deck's archetype colour identity even
 * though they have coloured pips. Sneaky Snacker is a free discard payoff that
 * shows up in otherwise-mono-red Madness decks; without this, every Mono-Red
 * Madness list reads as U/B.
 */
export const IDENTITY_EXEMPT_CARDS = new Set([
  // Free discard payoff played in otherwise mono-red Madness decks.
  "sneaky snacker",
  // Phyrexian spells
  "mutagenic growth", "gut shot", "apostle's blessing",
  "porcelain legionnaire", "spined thopter", "vault skirge",
  "pith driller", "thundering tanadon", "immolating souleater",
  "ruthless invasion", "binding souleater", "pestilent souleater",
  "trespassing souleater", "slash panther", "insatiable souleater",
  // Sideboard graveyard hate that is never actually cast.
  "faerie macabre",
]);

export interface ArchetypeRule {
  slug: string;
  name: string;
  signature: string[];
  requires?: string[];
  /** At least one of these cards must be present. */
  requiresAny?: string[];
  min_matches: number;
  /** Deck colour identity must include every one of these colours. */
  requiresColors?: CardColor[];
  /** Deck colour identity must include none of these colours. */
  excludesColors?: CardColor[];
  /** Deck colour identity must be a subset of these colours (mono-colour). */
  maxColors?: CardColor[];
}

const AFFINITY_SIGNATURE = [
  // Artifact core
  "myr enforcer",
  "thoughtcast",
  "galvanic blast",
  "frogmite",
  "krark-clan shaman",
  "ichor wellspring",
  "sojourner's companion",
  "blood fountain",
  // Glint-Hawk / Synthesizer package shared by Esper, Jeskai and four-colour
  "glint hawk",
  "kor skyfisher",
  "experimental synthesizer",
  "dispatch",
  "cryogen relic",
  "giant's boulder",
  "utrom monitor",
  "refurbished familiar",
  "baleful strix",
];

export const ARCHETYPE_RULES: ArchetypeRule[] = [
  // --- Affinity, split by colour identity -------------------------------
  {
    slug: "affinity-esper",
    name: "Esper Affinity",
    signature: AFFINITY_SIGNATURE,
    min_matches: 3,
    requiresColors: ["W", "U", "B"],
    excludesColors: ["R", "G"],
  },
  {
    slug: "affinity-grixis",
    name: "Grixis Affinity",
    signature: AFFINITY_SIGNATURE,
    min_matches: 3,
    requiresColors: ["U", "B", "R"],
    excludesColors: ["W", "G"],
  },
  {
    slug: "affinity-jeskai",
    name: "Jeskai Affinity",
    signature: AFFINITY_SIGNATURE,
    min_matches: 3,
    requiresColors: ["W", "U", "R"],
    excludesColors: ["B", "G"],
  },
  {
    slug: "affinity-mono-u",
    name: "Mono-Blue Affinity",
    signature: AFFINITY_SIGNATURE,
    min_matches: 3,
    requiresColors: ["U"],
    maxColors: ["U"],
  },
  {
    slug: "affinity-4c",
    name: "Four-Color Affinity",
    signature: AFFINITY_SIGNATURE,
    min_matches: 3,
    requiresColors: ["W", "U", "B", "R"],
    excludesColors: ["G"],
  },
  {
    slug: "affinity",
    name: "Affinity",
    signature: AFFINITY_SIGNATURE,
    min_matches: 3,
  },

  // --- Wildfire, split by colour identity --------------------------------
  // Any artifact-shell deck that runs Cleansing Wildfire is a Wildfire deck,
  // not Affinity, regardless of how much the rest of the list looks like it.
  {
    slug: "wildfire-jund",
    name: "Jund Wildfire",
    signature: [
      "cleansing wildfire",
      "writhing chrysalis",
      "fanatical offering",
      "gixian infiltrator",
      "ichor wellspring",
      "krark-clan shaman",
    ],
    requires: ["cleansing wildfire"],
    min_matches: 2,
    requiresColors: ["B", "R", "G"],
    excludesColors: ["W", "U"],
  },
  {
    slug: "wildfire-mardu",
    name: "Mardu Wildfire",
    signature: ["cleansing wildfire", "ichor wellspring", "kor skyfisher"],
    requires: ["cleansing wildfire"],
    min_matches: 1,
    requiresColors: ["W", "B", "R"],
    excludesColors: ["U", "G"],
  },
  {
    slug: "wildfire-rakdos",
    name: "Rakdos Wildfire",
    signature: ["cleansing wildfire", "ichor wellspring", "refurbished familiar"],
    requires: ["cleansing wildfire"],
    min_matches: 1,
    requiresColors: ["B", "R"],
    excludesColors: ["W", "U", "G"],
  },
  {
    slug: "wildfire-boros",
    name: "Boros Wildfire",
    signature: ["cleansing wildfire", "ichor wellspring", "kor skyfisher"],
    requires: ["cleansing wildfire"],
    min_matches: 1,
    requiresColors: ["W", "R"],
    excludesColors: ["U", "B", "G"],
  },
  {
    slug: "wildfire",
    name: "Wildfire",
    signature: ["cleansing wildfire"],
    requires: ["cleansing wildfire"],
    min_matches: 1,
  },

  // --- Mono-red Synthesizer ---------------------------------------------
  {
    slug: "mono-red-synthesizer",
    name: "Mono-Red Synthesizer",
    signature: [
      "experimental synthesizer",
      "reckless lackey",
      "goblin tomb raider",
      "inventor's axe",
      "gingerbrute",
      "clockwork percussionist",
      "galvanic blast",
      "lightning bolt",
    ],
    requires: ["experimental synthesizer"],
    min_matches: 3,
    requiresColors: ["R"],
    maxColors: ["R"],
  },

  // --- Blue tempo: Terror split by colour, then Faeries / Delver ----------
  {
    slug: "mono-blue-terror",
    name: "Mono-Blue Terror",
    signature: [
      "tolarian terror",
      "cryptic serpent",
      "thought scour",
      "mental note",
      "counterspell",
      "brainstorm",
      "preordain",
      "ponder",
      "deep analysis",
    ],
    min_matches: 3,
    requiresAny: ["tolarian terror", "cryptic serpent"],
    maxColors: ["U"],
  },
  {
    slug: "izzet-terror",
    name: "Izzet Terror",
    signature: [
      "tolarian terror",
      "cryptic serpent",
      "thought scour",
      "mental note",
      "counterspell",
      "brainstorm",
      "preordain",
      "ponder",
    ],
    min_matches: 3,
    requiresAny: ["tolarian terror", "cryptic serpent"],
    requiresColors: ["U", "R"],
    excludesColors: ["W", "B", "G"],
  },
  {
    slug: "dimir-terror",
    name: "Dimir Terror",
    signature: [
      "tolarian terror",
      "gurmag angler",
      "cast down",
      "counterspell",
      "brainstorm",
      "sneaky snacker",
      "consider",
    ],
    min_matches: 3,
    requiresAny: [
      "tolarian terror",
      "cryptic serpent",
      "the modern age",
    ],
    requiresColors: ["U", "B"],
    excludesColors: ["W", "R", "G"],
  },
  {
    slug: "dimir-faeries",
    name: "Dimir Faeries",
    signature: [
      "spellstutter sprite",
      "faerie seer",
      "ninja of the deep hours",
      "moon-circuit hacker",
      "augur of bolas",
      "counterspell",
      "brainstorm",
      "snuff out",
    ],
    // The tempo creatures are what separates Faeries from Dimir Control, which
    // plays the same removal and countermagic but no Ninja/Seer/Hacker engine.
    // Without this gate, control lists match on the generic blue/black cards.
    requiresAny: [
      "spellstutter sprite",
      "faerie seer",
      "ninja of the deep hours",
      "moon-circuit hacker",
    ],
    min_matches: 3,
    requiresColors: ["U", "B"],
    excludesColors: ["W", "R", "G"],
  },
  {
    slug: "mono-blue-faeries",
    name: "Mono-Blue Faeries",
    signature: [
      "spellstutter sprite",
      "faerie seer",
      "ninja of the deep hours",
      "moon-circuit hacker",
      "of one mind",
      "counterspell",
      "brainstorm",
    ],
    min_matches: 3,
    requiresColors: ["U"],
    maxColors: ["U"],
  },
  {
    slug: "azorius-faeries",
    name: "Azorius Faeries",
    signature: [
      "spellstutter sprite",
      "faerie seer",
      "moon-circuit hacker",
      "thraben inspector",
      "novice inspector",
      "kor skyfisher",
      "journey to nowhere",
      "of one mind",
      "thraben charm",
    ],
    requiresAny: ["spellstutter sprite", "faerie seer", "moon-circuit hacker"],
    min_matches: 3,
    requiresColors: ["W", "U"],
    excludesColors: ["B", "R", "G"],
  },
  {
    slug: "izzet-faeries",
    name: "Izzet Faeries",
    signature: [
      "spellstutter sprite",
      "faerie seer",
      "ninja of the deep hours",
      "moon-circuit hacker",
      "augur of bolas",
      "counterspell",
      "brainstorm",
      "skred",
      "lightning bolt",
      "relic of progenitus",
    ],
    // Same split as their Dimir cousins: the tempo creatures separate this from
    // the Izzet Skred control deck, which shares Skred, Bolt and Counterspell.
    requiresAny: [
      "spellstutter sprite",
      "faerie seer",
      "ninja of the deep hours",
      "moon-circuit hacker",
    ],
    min_matches: 3,
    requiresColors: ["U", "R"],
    excludesColors: ["W", "B", "G"],
  },
  {
    slug: "simic-delver",
    name: "Simic Delver",
    signature: [
      "delver of secrets",
      "tolarian terror",
      "nimble mongoose",
      "cache grab",
      "grapple with the past",
      "thought scour",
      "ponder",
      "brainstorm",
      "counterspell",
    ],
    requires: ["delver of secrets"],
    min_matches: 3,
    requiresColors: ["U", "G"],
    excludesColors: ["W", "B", "R"],
  },
  {
    slug: "delver",
    name: "Mono-Blue Delver",
    signature: [
      "delver of secrets",
      "counterspell",
      "brainstorm",
      "ponder",
      "preordain",
      "vapor snag",
      "ninja of the deep hours",
    ],
    requires: ["delver of secrets"],
    min_matches: 3,
    maxColors: ["U"],
  },

  // --- Madness, split by colour -----------------------------------------
  {
    slug: "izzet-madness",
    name: "Izzet Madness",
    signature: [
      "deep analysis",
      "guttersnipe",
      "kessig flamebreather",
      "highway robbery",
      "grab the prize",
      "lava dart",
      "faithless looting",
      "fiery temper",
    ],
    min_matches: 3,
    requiresColors: ["U", "R"],
    excludesColors: ["W", "B", "G"],
  },
  {
    slug: "rakdos-madness",
    name: "Rakdos Madness",
    signature: [
      "alms of the vein",
      "kitchen imp",
      "vampire's kiss",
      "bloodmad vampire",
      "fiery temper",
      "grab the prize",
      "highway robbery",
      "voldaren epicure",
    ],
    min_matches: 3,
    requiresColors: ["B", "R"],
    excludesColors: ["W", "U", "G"],
  },
  {
    slug: "monored-madness",
    name: "Monored Madness",
    signature: [
      "guttersnipe",
      "kessig flamebreather",
      "highway robbery",
      "grab the prize",
      "lava dart",
      "fiery temper",
      "faithless looting",
      "fireblast",
      "lightning bolt",
      "voldaren epicure",
    ],
    min_matches: 3,
    requiresColors: ["R"],
    maxColors: ["R"],
  },
  {
    slug: "boros-madness",
    name: "Boros Madness",
    signature: [
      "voldaren epicure",
      "sneaky snacker",
      "fiery temper",
      "faithless looting",
      "scrapwork mutt",
      "torch the tower",
      "lightning axe",
    ],
    min_matches: 3,
    requiresColors: ["W", "R"],
    excludesColors: ["U", "B", "G"],
  },
  {
    slug: "gruul-madness",
    name: "Gruul Madness",
    signature: [
      "faithless looting",
      "grab the prize",
      "highway robbery",
      "basking rootwalla",
      "scrapwork mutt",
      "sneaky snacker",
      "voldaren epicure",
      "fiery temper",
      "torch the tower",
    ],
    min_matches: 3,
    requiresColors: ["R", "G"],
    excludesColors: ["W", "U", "B"],
  },

  // --- Boros (strictly Red-White) ---------------------------------------
  {
    slug: "boros",
    name: "Boros Synthesizer",
    signature: [
      "kor skyfisher",
      "glint hawk",
      "experimental synthesizer",
      "galvanic blast",
      "lightning bolt",
      "thraben inspector",
      "journey to nowhere",
    ],
    min_matches: 3,
    requiresColors: ["W", "R"],
    maxColors: ["W", "R"],
  },

  // --- White Weenie -----------------------------------------------------
  {
    slug: "white-weenie",
    name: "White Weenie",
    signature: [
      "halo hopper",
      "martyr's soul",
      "ramosian rally",
      "salt road packbeast",
      "search party captain",
      "novice inspector",
      "thraben inspector",
      "leonardo, big brother",
      "spider-man, web-slinger",
    ],
    min_matches: 3,
    requiresColors: ["W"],
  },

  // --- Naya Bully -------------------------------------------------------
  {
    slug: "naya-bully",
    name: "Naya Bully",
    signature: [
      "battle screech",
      "squadron hawk",
      "lunarch veteran",
      "rally the peasants",
      "thraben inspector",
      "novice inspector",
      "springleaf drum",
      "writhing chrysalis",
    ],
    min_matches: 3,
    requiresColors: ["W", "R"],
  },

  // --- Seeker's Bow combo -----------------------------------------------
  // Hawkeye's Bow + Seeker of Skybreak: tap the equipped Seeker targeting
  // itself, untap, and repeat to ping the opponent to death.
  {
    slug: "seekers-bow",
    name: "Seeker's Bow",
    signature: [
      "hawkeye's bow",
      "seeker of skybreak",
      "writhing chrysalis",
      "malevolent rumble",
      "bitter reunion",
      "tamiyo's safekeeping",
      "melded moxite",
      "sneaky snacker",
      "first day of class",
      "midnight tilling",
      "commune with beavers",
    ],
    requires: ["hawkeye's bow", "seeker of skybreak"],
    min_matches: 2,
    requiresColors: ["R", "G"],
  },

  // --- Daru / Task Force combo ------------------------------------------
  // Nomads en-Kor redirects damage to Task Force or Daru Spiritualist to grow
  // toughness without bound, then Sheltering Word or Devour Flesh converts it
  // into life.
  {
    slug: "daru-combo",
    name: "Daru Combo",
    signature: [
      "task force",
      "daru spiritualist",
      "nomads en-kor",
      "spirit en-kor",
      "sheltering word",
      "devour flesh",
      "sagu wildling",
    ],
    requires: ["nomads en-kor"],
    requiresAny: ["daru spiritualist", "task force"],
    min_matches: 2,
    requiresColors: ["W"],
  },

  // --- Initiative combo -------------------------------------------------
  // Rituals into Goliath Paladin / Trailblazer's Torch to take the initiative.
  {
    slug: "turbo-initiative",
    name: "Turbo Initiative",
    signature: [
      "goliath paladin",
      "trailblazer's torch",
      "avenging hunter",
      "kick in the door",
      "burning-tree emissary",
      "simian spirit guide",
      "rite of flame",
      "seething song",
      "manamorphose",
      "lotus petal",
      "writhing chrysalis",
    ],
    requires: ["goliath paladin", "seething song"],
    min_matches: 3,
    requiresColors: ["R"],
  },

  // --- Golgari Gardens --------------------------------------------------
  {
    slug: "golgari-gardens",
    name: "Golgari Gardens",
    signature: [
      "eviscerator's insight",
      "khalni garden",
      "fanatical offering",
      "tithing blade",
      "crypt rats",
      "defile",
      "cast down",
    ],
    min_matches: 3,
    requiresColors: ["B", "G"],
    excludesColors: ["R"],
  },
  {
    slug: "mono-black-gardens",
    name: "Mono-Black Gardens",
    signature: [
      "fanatical offering",
      "eviscerator's insight",
      "khalni garden",
      "ichor wellspring",
      "tithing blade",
      "crypt rats",
      "defile",
      "cast down",
      "rancid earth",
      "accursed marauder",
      "reckoner's bargain",
    ],
    min_matches: 4,
    requiresColors: ["B"],
    maxColors: ["B"],
  },
  {
    slug: "jund-gardens",
    name: "Jund Gardens",
    signature: [
      "fanatical offering",
      "eviscerator's insight",
      "khalni garden",
      "ichor wellspring",
      "tithing blade",
      "crypt rats",
      "defile",
      "cast down",
      "writhing chrysalis",
      "avenging hunter",
      "skred",
    ],
    requires: ["khalni garden"],
    min_matches: 4,
    requiresColors: ["B", "R", "G"],
  },

  // --- Spy Combo family -------------------------------------------------
  // Balustrade Spy + Dread Return + Lotleth Giant is the kill; the deck is
  // named for the shell it ramps with (Elves, Walls, or neither).
  {
    slug: "elves-spy-combo",
    name: "Elves Spy Combo",
    signature: [
      "balustrade spy",
      "dread return",
      "lotleth giant",
      "priest of titania",
      "llanowar elves",
      "birchlore rangers",
      "timberwatch elf",
      "jaspera sentinel",
      "elvish mystic",
      "fyndhorn elves",
      "lead the stampede",
      "winding way",
    ],
    requires: ["balustrade spy"],
    requiresAny: [
      "priest of titania",
      "llanowar elves",
      "birchlore rangers",
      "timberwatch elf",
      "jaspera sentinel",
      "elvish mystic",
      "fyndhorn elves",
    ],
    min_matches: 3,
  },
  {
    slug: "wall-spy-combo",
    name: "Wall Spy Combo",
    signature: [
      "balustrade spy",
      "dread return",
      "lotleth giant",
      "overgrown battlement",
      "wall of roots",
      "saruli caretaker",
      "gatecreeper vine",
      "lead the stampede",
      "generous ent",
      "sagu wildling",
    ],
    requires: ["balustrade spy"],
    requiresAny: [
      "overgrown battlement",
      "wall of roots",
      "saruli caretaker",
      "gatecreeper vine",
      "axebane guardian",
    ],
    min_matches: 3,
  },
  {
    slug: "spy-combo",
    name: "Spy Combo",
    signature: ["balustrade spy", "dread return", "lotleth giant", "generous ent"],
    requires: ["balustrade spy"],
    min_matches: 2,
  },

  // --- Grixis Control ---------------------------------------------------
  {
    slug: "grixis-control",
    name: "Grixis Control",
    signature: [
      "counterspell",
      "cast down",
      "terminate",
      "lorien revealed",
      "murmuring mystic",
      "sulfurous blast",
      "devious cover-up",
      "behold the multiverse",
      "unfathomable truths",
    ],
    min_matches: 3,
    requiresColors: ["U", "B", "R"],
    excludesColors: ["W", "G"],
  },

  // --- Temur Skred ------------------------------------------------------
  {
    slug: "temur-skred",
    name: "Temur Skred",
    signature: [
      "skred",
      "writhing chrysalis",
      "leyline weaver",
      "unfathomable truths",
      "preordain",
      "brainstorm",
      "counterspell",
      "lightning bolt",
    ],
    requires: ["skred"],
    min_matches: 3,
    requiresColors: ["U", "R", "G"],
    excludesColors: ["W", "B"],
  },

  // --- Izzet Skred (control) --------------------------------------------
  {
    slug: "izzet-skred",
    name: "Izzet Skred",
    signature: [
      "skred",
      "murmuring mystic",
      "counterspell",
      "lorien revealed",
      "lightning bolt",
      "preordain",
      "ponder",
      "cryogen relic",
      "hard evidence",
      "omen of the sea",
      "behold the multiverse",
      "fanged flames",
      "bender's waterskin",
      "azure fleet admiral",
    ],
    // Murmuring Mystic is the win condition; the Izzet Faeries tempo deck is
    // caught by its own creature gate before it can out-score this on the
    // shared Skred / Bolt / Counterspell shell. The gate below excludes the
    // Tolarian Terror deck, which also plays Mystic + Skred.
    requires: ["murmuring mystic"],
    requiresAny: [
      "cryogen relic",
      "hard evidence",
      "omen of the sea",
      "abjure",
      "bender's waterskin",
      "logic knot",
      "mana leak",
      "negate",
      "deduce",
      "oliphaunt",
      "exclude",
    ],
    min_matches: 4,
    requiresColors: ["U", "R"],
    excludesColors: ["W", "B", "G"],
  },

  // --- Ephemerate, named by colour identity ------------------------------
  {
    slug: "ephemerate-jeskai",
    name: "Jeskai Ephemerate",
    signature: [
      "ephemerate",
      "archaeomancer",
      "mulldrifter",
      "counterspell",
      "lorien revealed",
      "augur of bolas",
      "skred",
      "dispel",
    ],
    requires: ["ephemerate"],
    min_matches: 2,
    requiresColors: ["W", "U", "R"],
    excludesColors: ["B", "G"],
  },
  {
    slug: "ephemerate-esper",
    name: "Esper Ephemerate",
    signature: [
      "ephemerate",
      "archaeomancer",
      "mulldrifter",
      "counterspell",
      "lorien revealed",
      "augur of bolas",
      "cast down",
      "dispel",
    ],
    requires: ["ephemerate"],
    min_matches: 2,
    requiresColors: ["W", "U", "B"],
    excludesColors: ["R", "G"],
  },
  {
    slug: "ephemerate-azorius",
    name: "Azorius Ephemerate",
    signature: [
      "ephemerate",
      "archaeomancer",
      "mulldrifter",
      "counterspell",
      "lorien revealed",
      "augur of bolas",
      "dispel",
    ],
    requires: ["ephemerate"],
    min_matches: 2,
    requiresColors: ["W", "U"],
    maxColors: ["W", "U"],
  },
  {
    slug: "ephemerate-bant",
    name: "Bant Ephemerate",
    signature: [
      "ephemerate",
      "archaeomancer",
      "mulldrifter",
      "counterspell",
      "lorien revealed",
      "augur of bolas",
      "dispel",
    ],
    requires: ["ephemerate"],
    min_matches: 2,
    requiresColors: ["W", "U", "G"],
    excludesColors: ["B", "R"],
  },
  {
    slug: "ephemerate",
    name: "Ephemerate",
    signature: ["ephemerate"],
    requires: ["ephemerate"],
    min_matches: 1,
  },

  // --- Rest -------------------------------------------------------------
  {
    slug: "tron", name: "Tron", signature: [
      "urza's tower", "urza's mine", "urza's power plant", "expedition map",
      "mnemonic wall", "rolling thunder", "candy trail", "conduit pylons",
    ], requires: ["urza's tower", "urza's mine", "urza's power plant"], min_matches: 3
  },
  {
    slug: "burn", name: "Burn", signature: [
      "lightning bolt", "chain lightning", "fireblast", "lava spike", "rift bolt",
      "searing blaze", "skewer the critics",
    ], min_matches: 3
  },
  {
    slug: "goblins", name: "Goblins", signature: [
      "goblin bushwhacker", "mogg war marshal", "battle cry goblin", "goblin cohort",
      "first day of class", "rally the peasants", "goblin grenade",
    ], min_matches: 3
  },
  {
    slug: "rdw", name: "Mono-Red Aggro", signature: [
      "monastery swiftspear", "goblin tomb raider", "burning-tree emissary",
      "kiln fiend", "reckless impulse", "brute force", "galvanic blast",
    ], min_matches: 3
  },
  {
    slug: "ub-control",
    name: "Dimir Control",
    signature: [
      "murmuring mystic",
      "campfire",
      "cut down",
      "preordain",
      "plunder the trollshaws",
      "lose focus",
      "innocent blood",
      "wretched banquet",
      "drown in sorrow",
      "devious cover-up",
    ],
    // These are the control build's own cards. Cast Down, Snuff Out and
    // Counterspell are deliberately absent: the tempo Faeries and Dimir Terror
    // decks play them too, so a signature built on them swallows both.
    min_matches: 3,
    requiresColors: ["U", "B"],
    excludesColors: ["W", "R", "G"],
  },
  {
    slug: "mono-black", name: "Mono-Black Control", signature: [
      "defile", "crypt rats", "chittering rats", "phyrexian rager",
      "sign in blood", "unearth", "cuombajj witches",
    ], min_matches: 3
  },
  {
    slug: "bogles", name: "Bogles", signature: [
      "slippery bogle", "ethereal armor", "rancor", "ancestral mask",
      "abundant growth", "gladecover scout",
    ], min_matches: 3
  },
  {
    slug: "heroic", name: "Mono-White Heroic", signature: [
      "ethereal armor", "cartouche of solidarity", "hyena umbra",
      "akroan skyguard", "lagonna-band trailblazer", "emergent growth",
    ], min_matches: 3
  },
  {
    slug: "infect", name: "Infect", signature: [
      "glistener elf", "ichorclaw myr", "rancor", "invigorate",
      "mutagenic growth", "apostle's blessing",
    ], min_matches: 3
  },
  {
    slug: "elves", name: "Elves", signature: [
      "llanowar elves", "priest of titania", "timberwatch elf", "distant melody",
      "quirion ranger", "birchlore rangers", "wellwisher",
    ], min_matches: 3
  },
  {
    slug: "familiars", name: "Familiars", signature: [
      "sunscape familiar", "nightscape familiar", "snap", "ghostly flicker",
      "mulldrifter", "sea gate oracle",
    ], min_matches: 3
  },
  {
    slug: "walls", name: "Walls Combo", signature: [
      "axebane guardian", "overgrown battlement", "wall of roots",
      "saruli caretaker", "lead the stampede", "freed from the real",
      "drift of phantasms", "wall of tanglecord",
    ], requires: ["axebane guardian"], min_matches: 2
  },
  {
    slug: "gond", name: "Midnight Gond Combo", signature: [
      "midnight guard", "presence of gond", "hedron crab",
    ], min_matches: 2
  },
  {
    slug: "cycle-storm", name: "Cycle Storm", signature: [
      "songs of the damned", "drannith healer", "drannith stinger",
      "gnarled cathode", "horror of the broken lands",
    ], min_matches: 2
  },
  {
    slug: "turbo-fog", name: "Turbo Fog", signature: [
      "fog", "moment's peace", "tangle", "respite", "sprout swarm",
    ], min_matches: 2
  },
  {
    slug: "white-tokens", name: "White Tokens", signature: [
      "battle screech", "raise the alarm", "triplicate spirits", "intangible virtue",
      "mosquito guard", "prismatic strands",
    ], min_matches: 2
  },
  {
    slug: "mogwarts", name: "Moggwarts", signature: [
      "putrid goblin", "first day of class", "skirk prospector",
      "brightstone ritual", "unearth", "goblin anarchomancer",
    ], min_matches: 3
  },
  {
    slug: "hot-dogs", name: "Hot Dogs", signature: [
      "kiln fiend", "temur battle rage", "lightning bolt", "brute force",
      "assault strobe", "invigorated rampage", "reckless charge",
    ], min_matches: 3
  },
  {
    slug: "mono-black-devotion", name: "Mono-Black Devotion", signature: [
      "gray merchant of asphodel", "phyrexian rager", "cuombajj witches",
      "unearth", "sign in blood", "chittering rats",
    ], min_matches: 3
  },
  {
    slug: "mono-green-stompy", name: "Mono-Green Stompy", signature: [
      "burning-tree emissary", "nest invader", "elephant guide", "rancor",
      "young wolf", "vines of vastwood", "hunger of the howlpack",
    ], min_matches: 3
  },
  {
    slug: "mill", name: "Mill", signature: [
      "jace's phantasm", "thought scour", "tome scour", "dream twist",
    ], min_matches: 2
  },
  {
    slug: "tortex", name: "Tortured Existence", signature: [
      "tortured existence", "golgari brownscale", "putrid imp", "grave scrabbler",
      "commune with the gods", "stinkweed imp",
    ], requires: ["tortured existence"], min_matches: 2
  },
  {
    slug: "dredge", name: "Dredge", signature: [
      "stinkweed imp", "lotleth giant", "dread return", "scrapwork mutt",
      "satyr wayfinder", "basking rootwalla", "gnaw to the bone",
      "malevolent rumble", "circle of the land druid", "generous ent",
    ], requires: ["dread return"], min_matches: 2
  },
  {
    slug: "inside-out", name: "Inside Out", signature: [
      "inside out", "aurora eidolon", "tireless tribe", "pursue the past",
      "thrilling discovery", "sandstorm eidolon", "bitter reunion",
    ], requires: ["inside out"], min_matches: 2
  },
  {
    slug: "persistent-petitioners", name: "Persistent Petitioners", signature: [
      "persistent petitioners", "mothdust changeling", "masked vandal",
      "glistener seer", "pond prophet", "undercover skrull", "of one mind",
      "winding way",
    ], requires: ["persistent petitioners"], min_matches: 2
  },
  {
    slug: "ponza", name: "Ponza", signature: [
      "arbor elf", "thermokarst", "mwonvuli acid-moss", "stone rain", "utopia sprawl",
    ], min_matches: 2
  },
  {
    slug: "poison-storm", name: "Poison Storm", signature: [
      "infectious inquiry", "prologue to phyresis", "contentious plan",
      "experimental augury", "vivisurgeon's insight", "thirsting roots",
      "weather the storm", "pentad prism", "focus the mind", "teach by example",
      "steady progress",
    ], requiresAny: ["prologue to phyresis", "infectious inquiry"],
    min_matches: 3
  },
  {
    slug: "storm", name: "Storm", signature: [
      "manamorphose", "goblin anarchomancer", "big score", "hickory woodlot",
      "geothermal crevice", "sandstone needle", "desperate ritual",
      "glimpse the impossible", "empty the warrens", "grapeshot",
    ], requires: ["seize the storm"], min_matches: 3
  },
  {
    slug: "gates", name: "Gates", signature: [
      "basilisk gate", "guardian of the guildpact", "sea gate", "black dragon gate",
      "citadel gate", "counterspell",
    ], min_matches: 3
  },
  {
    slug: "caw-gates", name: "Caw-Gates", signature: [
      "squadron hawk", "sacred cat", "basilisk gate", "guardian of the guildpact",
      "journey to nowhere", "prismatic strands", "counterspell", "brainstorm",
    ], requires: ["squadron hawk", "sacred cat"], min_matches: 3
  },
  {
    slug: "naya-gates", name: "Naya Gates", signature: [
      "basilisk gate", "sacred cat", "citadel gate", "cliffgate",
      "writhing chrysalis", "sneaky snacker", "pursue the past",
      "malevolent rumble", "prismatic strands", "manor gate", "outlaw medic",
    ], requires: ["basilisk gate", "sacred cat"], min_matches: 3,
    requiresColors: ["W"], excludesColors: ["U"]
  },
  {
    slug: "jund-gates", name: "Jund Gates", signature: [
      "basilisk gate", "cliffgate", "black dragon gate", "manor gate",
      "ichor wellspring", "krark-clan shaman", "writhing chrysalis",
      "sneaky snacker", "melded moxite", "eviscerator's insight", "cast down",
    ], requires: ["basilisk gate"],
    requiresAny: ["krark-clan shaman", "melded moxite", "toxin analysis"],
    min_matches: 3, requiresColors: ["B", "R", "G"]
  },
  {
    slug: "mono-black-sacrifice", name: "Mono-Black Sacrifice", signature: [
      "carrion feeder", "mortician beetle", "bloodthrone vampire",
      "nested shambler", "village rites", "supernatural stamina",
      "infestation sage", "perigee beckoner",
    ], min_matches: 3, maxColors: ["B"]
  },
  {
    slug: "mono-red-blitz", name: "Mono-Red Blitz", signature: [
      "kiln fiend", "festival crasher", "burning prophet", "crash through",
      "warlord's fury", "ancestral anger", "assault strobe", "mutagenic growth",
      "lava dart", "red mage's rapier",
    ], requires: ["kiln fiend"],
    requiresAny: ["burning prophet", "warlord's fury", "ancestral anger",
      "red mage's rapier"],
    min_matches: 3, maxColors: ["R"]
  },
  {
    slug: "reanimator", name: "Reanimator", signature: [
      "exhume", "dark ritual", "troll of khazad-dûm", "generous ent",
      "malevolent rumble", "avenging hunter", "duress", "unexpected fangs",
    ], requires: ["exhume"], min_matches: 2, requiresColors: ["B"]
  },
  {
    slug: "gruul-eldrazi", name: "Gruul Eldrazi", signature: [
      "eldrazi repurposer", "brood birthing", "molten gatekeeper", "nest invader",
      "impact tremors", "hissing iguanar", "sprout swarm", "writhing chrysalis",
      "malevolent rumble", "essence warden",
    ], requiresAny: ["impact tremors", "molten gatekeeper", "brood birthing"],
    min_matches: 3, requiresColors: ["R", "G"], excludesColors: ["W", "U", "B"]
  },
  {
    slug: "mono-green-counters", name: "Mono-Green Counters", signature: [
      "experiment one", "hunger of the howlpack", "contagious vorrac",
      "longstalk brawl", "duskshell crawler", "aquastrand spider",
      "knight of wundagore", "servant of the scale", "skarrgan pit-skulk",
      "sunshower druid",
    ], min_matches: 3, requiresColors: ["G"], maxColors: ["G"]
  },
];

export interface Classification {
  slug: string;
  name: string;
  confidence: number;
  matches: number;
}

const RULE_BY_SLUG = new Map(ARCHETYPE_RULES.map((rule) => [rule.slug, rule]));
const OTHER: Classification = {
  slug: "other",
  name: "Other",
  confidence: 0,
  matches: 0,
};

function ruleSpecificity(rule: ArchetypeRule): number {
  return (
    (rule.requires?.length ?? 0) +
    (rule.requiresAny ? 1 : 0) +
    (rule.requiresColors?.length ?? 0) +
    (rule.excludesColors?.length ?? 0) +
    (rule.maxColors ? 1 : 0)
  );
}

function matchesColors(
  rule: ArchetypeRule,
  identity: Set<CardColor>,
): boolean {
  if (rule.requiresColors?.some((color) => !identity.has(color))) return false;
  if (rule.excludesColors?.some((color) => identity.has(color))) return false;
  if (
    rule.maxColors &&
    [...identity].some((color) => !rule.maxColors!.includes(color))
  ) {
    return false;
  }
  return true;
}

export function classifyDeck(
  cardNames: Iterable<string>,
  colorIdentity: Iterable<CardColor> = [],
): Classification {
  const present = new Set<string>();
  for (const name of cardNames) present.add(normalizeName(name));
  const identity = new Set<CardColor>(colorIdentity);

  let best: Classification = OTHER;
  let bestSpecificity = 0;
  for (const rule of ARCHETYPE_RULES) {
    if (rule.requires?.some((name) => !present.has(normalizeName(name)))) {
      continue;
    }
    if (
      rule.requiresAny &&
      !rule.requiresAny.some((name) => present.has(normalizeName(name)))
    ) {
      continue;
    }
    if (!matchesColors(rule, identity)) continue;

    const matches = rule.signature.filter((name) =>
      present.has(normalizeName(name)),
    ).length;
    if (matches < rule.min_matches) continue;

    const confidence = matches / rule.signature.length;
    const specificity = ruleSpecificity(rule);
    const better =
      matches > best.matches ||
      (matches === best.matches && confidence > best.confidence) ||
      (matches === best.matches &&
        confidence === best.confidence &&
        specificity > bestSpecificity);

    if (better) {
      best = { slug: rule.slug, name: rule.name, confidence, matches };
      bestSpecificity = specificity;
    }
  }
  return best;
}

export function archetypeName(slug: string): string {
  return RULE_BY_SLUG.get(slug)?.name ?? (slug === "other" ? "Other" : slug);
}
