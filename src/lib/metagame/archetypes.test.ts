import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyDeck, archetypeName } from "./archetypes";

test("classifies mono-blue delver from its core cards", () => {
  const result = classifyDeck(
    ["Delver of Secrets", "Counterspell", "Brainstorm", "Ponder"],
    ["U"],
  );
  assert.equal(result.slug, "delver");
});

test("classifies burn from burn spells", () => {
  const result = classifyDeck(
    ["Lightning Bolt", "Chain Lightning", "Fireblast", "Lava Spike"],
    ["R"],
  );
  assert.equal(result.slug, "burn");
});

test("classifies bogles from the hexproof shell", () => {
  const result = classifyDeck(
    ["Slippery Bogle", "Ethereal Armor", "Rancor", "Ancestral Mask"],
    ["W", "G"],
  );
  assert.equal(result.slug, "bogles");
});

test("spy combo requires Balustrade Spy", () => {
  const withSpy = classifyDeck(
    ["Balustrade Spy", "Dread Return", "Lotleth Giant"],
    ["B"],
  );
  assert.equal(withSpy.slug, "spy-combo");

  const withoutSpy = classifyDeck(["Dread Return", "Lotleth Giant"], ["B"]);
  assert.notEqual(withoutSpy.slug, "spy-combo");
});

test("respects color gates (delver is mono-blue only)", () => {
  const monoblue = classifyDeck(
    ["Delver of Secrets", "Counterspell", "Brainstorm", "Ponder"],
    ["U"],
  );
  const izzet = classifyDeck(
    ["Delver of Secrets", "Counterspell", "Brainstorm", "Ponder"],
    ["U", "R"],
  );
  assert.equal(monoblue.slug, "delver");
  assert.notEqual(izzet.slug, "delver");
});

test("returns the fallback archetype when nothing matches", () => {
  const result = classifyDeck(["Some Unrelated Card"], ["W"]);
  assert.equal(result.slug, "other");
});

test("classifies the Dimir Faeries tempo engine", () => {
  const result = classifyDeck(
    [
      "Spellstutter Sprite",
      "Faerie Seer",
      "Ninja of the Deep Hours",
      "Moon-Circuit Hacker",
      "Counterspell",
      "Brainstorm",
      "Snuff Out",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "dimir-faeries");
});

test("classifies Dimir Control from its own cards, not the shared shell", () => {
  const result = classifyDeck(
    [
      "Murmuring Mystic",
      "Campfire",
      "Cut Down",
      "Preordain",
      "Plunder the Trollshaws",
      "Counterspell",
      "Cast Down",
      "Snuff Out",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "ub-control");
});

test("a control list without the faerie engine is not Dimir Faeries", () => {
  const result = classifyDeck(
    [
      "Counterspell",
      "Cast Down",
      "Snuff Out",
      "Brainstorm",
      "Baleful Strix",
      "Augur of Bolas",
      "Murmuring Mystic",
      "Campfire",
      "Cut Down",
      "Preordain",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "ub-control");
});

test("a faerie deck keeps the label when it splashes control cards", () => {
  const result = classifyDeck(
    [
      "Spellstutter Sprite",
      "Faerie Seer",
      "Ninja of the Deep Hours",
      "Moon-Circuit Hacker",
      "Counterspell",
      "Brainstorm",
      "Snuff Out",
      "Murmuring Mystic",
      "Campfire",
      "Cut Down",
      "Preordain",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "dimir-faeries");
});

test("separates Izzet Faeries from Izzet Skred control", () => {
  const faeries = classifyDeck(
    [
      "Spellstutter Sprite",
      "Faerie Seer",
      "Moon-Circuit Hacker",
      "Counterspell",
      "Brainstorm",
      "Skred",
      "Lightning Bolt",
    ],
    ["U", "R"],
  );
  assert.equal(faeries.slug, "izzet-faeries");

  const control = classifyDeck(
    [
      "Skred",
      "Murmuring Mystic",
      "Counterspell",
      "Lórien Revealed",
      "Lightning Bolt",
      "Cryogen Relic",
      "Hard Evidence",
    ],
    ["U", "R"],
  );
  assert.equal(control.slug, "izzet-skred");
});

test("a Tolarian Terror deck is not stolen by Izzet Skred", () => {
  const result = classifyDeck(
    [
      "Tolarian Terror",
      "Skred",
      "Counterspell",
      "Brainstorm",
      "Ponder",
      "Murmuring Mystic",
    ],
    ["U", "R"],
  );
  assert.equal(result.slug, "izzet-terror");
});

test("classifies Mono-Black Gardens from its sacrifice shell", () => {
  const result = classifyDeck(
    [
      "Fanatical Offering",
      "Eviscerator's Insight",
      "Khalni Garden",
      "Ichor Wellspring",
      "Crypt Rats",
      "Defile",
      "Cast Down",
    ],
    ["B"],
  );
  assert.equal(result.slug, "mono-black-gardens");
});

test("classifies the Seeker's Bow combo", () => {
  const result = classifyDeck(
    [
      "Hawkeye's Bow",
      "Seeker of Skybreak",
      "Writhing Chrysalis",
      "Malevolent Rumble",
      "Bitter Reunion",
    ],
    ["R", "G"],
  );
  assert.equal(result.slug, "seekers-bow");
});

test("classifies the Daru / Task Force combo", () => {
  const result = classifyDeck(
    ["Task Force", "Daru Spiritualist", "Nomads en-Kor", "Sheltering Word"],
    ["W"],
  );
  assert.equal(result.slug, "daru-combo");
});

test("classifies Reanimator from Exhume", () => {
  const result = classifyDeck(
    ["Exhume", "Dark Ritual", "Troll of Khazad-dûm", "Generous Ent"],
    ["B"],
  );
  assert.equal(result.slug, "reanimator");
});

test("classifies Turbo Initiative from the ritual + paladin shell", () => {
  const result = classifyDeck(
    [
      "Goliath Paladin",
      "Seething Song",
      "Rite of Flame",
      "Burning-Tree Emissary",
      "Manamorphose",
    ],
    ["R"],
  );
  assert.equal(result.slug, "turbo-initiative");
});

test("a Kiln Fiend Hot Dogs deck is not stolen by Mono-Red Blitz", () => {
  const result = classifyDeck(
    ["Kiln Fiend", "Temur Battle Rage", "Brute Force", "Assault Strobe", "Lightning Bolt"],
    ["R"],
  );
  assert.equal(result.slug, "hot-dogs");
});


test("classifies Pizza Combo from the Devoted Druid package", () => {
  const result = classifyDeck(
    [
      "Devoted Druid",
      "Guac & Marshmallow Pizza",
      "Banishing Knack",
      "Cryogen Relic",
      "Perilous Research",
      "Khalni Garden",
      "Mystical Teachings",
    ],
    ["U", "G"],
  );
  assert.equal(result.slug, "pizza-combo");
});

test("classifies Slivers from the lord package", () => {
  const result = classifyDeck(
    [
      "Gemhide Sliver",
      "Muscle Sliver",
      "Predatory Sliver",
      "Sinew Sliver",
      "Plated Sliver",
      "Sidewinder Sliver",
    ],
    ["W", "U", "B", "R", "G"],
  );
  assert.equal(result.slug, "slivers");
});

test("classifies Izzet Skred without Murmuring Mystic", () => {
  const result = classifyDeck(
    [
      "Skred",
      "Serpentine Curve",
      "Fling",
      "Breath Weapon",
      "Counterspell",
      "Brainstorm",
      "Lightning Bolt",
      "Preordain",
    ],
    ["U", "R"],
  );
  assert.equal(result.slug, "izzet-skred");
});

test("classifies blue-splash Hot Dogs without stealing Mono-Red Blitz", () => {
  const hotDogs = classifyDeck(
    [
      "Kiln Fiend",
      "Apostle's Blessing",
      "Assault Strobe",
      "Mutagenic Growth",
      "Manamorphose",
      "Slip Through Space",
      "Nivix Cyclops",
    ],
    ["U", "R"],
  );
  assert.equal(hotDogs.slug, "hot-dogs");

  const blitz = classifyDeck(
    [
      "Kiln Fiend",
      "Ancestral Anger",
      "Burning Prophet",
      "Warlord's Fury",
      "Assault Strobe",
      "Mutagenic Growth",
      "Lava Dart",
      "Festival Crasher",
    ],
    ["R"],
  );
  assert.equal(blitz.slug, "mono-red-blitz");
});

test("Walls Combo excludes Balustrade Spy shells", () => {
  const walls = classifyDeck(
    [
      "Overgrown Battlement",
      "Wall of Roots",
      "Saruli Caretaker",
      "Quirion Ranger",
      "Generous Ent",
      "Lead the Stampede",
    ],
    ["G"],
  );
  assert.equal(walls.slug, "walls");

  const spy = classifyDeck(
    [
      "Balustrade Spy",
      "Dread Return",
      "Lotleth Giant",
      "Overgrown Battlement",
      "Wall of Roots",
      "Saruli Caretaker",
    ],
    ["G"],
  );
  assert.equal(spy.slug, "wall-spy-combo");
});

test("classifies Aristocrats and exposes the new display name", () => {
  const result = classifyDeck(
    [
      "Carrion Feeder",
      "Mortician Beetle",
      "Bloodthrone Vampire",
      "Greedy Freebooter",
      "Shambling Ghast",
      "Village Rites",
      "Nested Shambler",
      "Supernatural Stamina",
    ],
    ["B"],
  );
  assert.equal(result.slug, "mono-black-sacrifice");
  assert.equal(archetypeName(result.slug), "Aristocrats");
});

test("classifies Mono-Black Burn and leaves Rakdos Burn alone", () => {
  const monoBlack = classifyDeck(
    [
      "Bump in the Night",
      "Tyrant's Choice",
      "Vampire's Kiss",
      "Black Mage's Rod",
      "Serrated Scorpion",
      "Sovereign's Bite",
    ],
    ["B"],
  );
  assert.equal(monoBlack.slug, "mono-black-burn");

  const rakdos = classifyDeck(
    [
      "Bump in the Night",
      "Tyrant's Choice",
      "Vampire's Kiss",
      "Black Mage's Rod",
      "Blightning",
      "Lightning Bolt",
    ],
    ["B", "R"],
  );
  assert.notEqual(rakdos.slug, "mono-black-burn");
});

test("classifies Golgari Lifegain", () => {
  const result = classifyDeck(
    [
      "Essence Warden",
      "Marauding Blight-Priest",
      "Pest Mascot",
      "Blood Researcher",
      "Bogwater Lumaret",
      "Follow the Lumarets",
    ],
    ["B", "G"],
  );
  assert.equal(result.slug, "golgari-lifegain");
});

test("classifies Gruul Aggro and Gruul Landfall separately", () => {
  const aggro = classifyDeck(
    [
      "Cloakwood Swarmkeeper",
      "Glimmer Bairn",
      "Hooting Mandrills",
      "Malevolent Rumble",
      "Many Partings",
      "Writhing Chrysalis",
    ],
    ["R", "G"],
  );
  assert.equal(aggro.slug, "gruul-aggro");

  const landfall = classifyDeck(
    [
      "Adventuring Gear",
      "Akoum Hellhound",
      "Plated Geopede",
      "Crop Rotation",
      "Harrow",
      "Lightning Bolt",
    ],
    ["R", "G"],
  );
  assert.equal(landfall.slug, "gruul-landfall");
});

test("classifies Izzet Land Bounce", () => {
  const result = classifyDeck(
    [
      "Boomerang",
      "Eye of Nowhere",
      "Hoodwink",
      "Fire / Ice",
      "Tolarian Terror",
      "Breath Weapon",
      "Counterspell",
    ],
    ["U", "R"],
  );
  assert.equal(result.slug, "izzet-land-bounce");
});

test("classifies Zubera Combo", () => {
  const result = classifyDeck(
    [
      "Ashen-Skin Zubera",
      "Dripping-Tongue Zubera",
      "Ember-Fist Zubera",
      "Ashnod's Altar",
      "Drift of Phantasms",
      "Energy Refractor",
    ],
    ["U", "B", "R", "G"],
  );
  assert.equal(result.slug, "zubera-combo");
});

test("classifies Simic Tokens", () => {
  const result = classifyDeck(
    [
      "Gene Pollinator",
      "Keep Watch",
      "Nest Invader",
      "Rites of Initiation",
      "Scatter the Seeds",
      "Khalni Garden",
      "Writhing Chrysalis",
    ],
    ["G", "U"],
  );
  assert.equal(result.slug, "simic-tokens");
});

test("classifies Green-White Hare Apparent", () => {
  const result = classifyDeck(
    [
      "Hare Apparent",
      "Charge",
      "Echoing Courage",
      "Might of the Masses",
      "Radiant Grove",
    ],
    ["W", "G"],
  );
  assert.equal(result.slug, "hare-apparent-gw");
});


test("classifies BGW lifegain as Abzan Lifegain", () => {
  const result = classifyDeck(
    [
      "Essence Warden",
      "Soul Warden",
      "Marauding Blight-Priest",
      "Pest Mascot",
      "Hinterland Sanctifier",
      "Jaspera Sentinel",
      "Winding Way",
    ],
    ["W", "B", "G"],
  );
  assert.equal(result.slug, "abzan-lifegain");
});

test("classifies Altar Combo from the Retriever shell", () => {
  const result = classifyDeck(
    [
      "Ashnod's Altar",
      "Myr Retriever",
      "Cauldron Familiar",
      "Golden Egg",
      "Lembas",
      "Nutrient Block",
      "Molten Gatekeeper",
    ],
    ["B", "R", "G"],
  );
  assert.equal(result.slug, "altar-combo");
});

test("classifies Dimir Eidolon from the Eidolon shell", () => {
  const result = classifyDeck(
    [
      "Enigma Eidolon",
      "Entropic Eidolon",
      "Shipwreck Sifters",
      "Abandon Attachments",
      "Dihada's Ploy",
      "Sneaky Snacker",
      "Foil",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "dimir-eidolon");
});

test("classifies Temur Cascade without stealing Temur Skred", () => {
  const cascade = classifyDeck(
    [
      "Annoyed Altisaur",
      "Boarding Party",
      "Mulldrifter",
      "Writhing Chrysalis",
      "Arboreal Grazer",
      "Growth Spiral",
      "Simic Growth Chamber",
    ],
    ["U", "R", "G"],
  );
  assert.equal(cascade.slug, "temur-cascade");

  const skred = classifyDeck(
    [
      "Skred",
      "Annoyed Altisaur",
      "Boarding Party",
      "Writhing Chrysalis",
      "Lightning Bolt",
      "Brainstorm",
      "Bountiful Landscape",
    ],
    ["U", "R", "G"],
  );
  assert.equal(skred.slug, "temur-skred");
});


test("splits Orzhov lifegain from Orzhov aggro", () => {
  const lifegain = classifyDeck(
    [
      "Breathless Knight",
      "Cauldron Familiar",
      "Suture Priest",
      "Soul Warden",
      "Marauding Blight-Priest",
      "Unearth",
      "Village Rites",
    ],
    ["W", "B"],
  );
  assert.equal(lifegain.slug, "orzhov-lifegain");

  const aggro = classifyDeck(
    [
      "Breathless Knight",
      "Cauldron Familiar",
      "Unearth",
      "Village Rites",
      "Recommission",
      "Carrot Cake",
      "Fanatical Offering",
      "Militia Bugler",
    ],
    ["W", "B"],
  );
  assert.equal(aggro.slug, "orzhov-aggro");
});

test("classifies Rally at the Hornburg as Mono-Red Rally", () => {
  const rally = classifyDeck(
    [
      "Rally at the Hornburg",
      "Goblin Bushwhacker",
      "Goblin Tomb Raider",
      "Clockwork Percussionist",
      "Voldaren Epicure",
      "Great Furnace",
      "Burning-Tree Emissary",
    ],
    ["R"],
  );
  assert.equal(rally.slug, "mono-red-rally");
});

test("Mono-Red Rally does not steal Experimental Synthesizer decks", () => {
  const synthesizer = classifyDeck(
    [
      "Experimental Synthesizer",
      "Rally at the Hornburg",
      "Goblin Bushwhacker",
      "Goblin Tomb Raider",
      "Clockwork Percussionist",
      "Voldaren Epicure",
      "Great Furnace",
    ],
    ["R"],
  );
  assert.equal(synthesizer.slug, "mono-red-synthesizer");
});


test("classifies mono-white Clowning Around decks", () => {
  const result = classifyDeck(
    [
      "Clowning Around",
      "Thraben Inspector",
      "Novice Inspector",
      "Leonardo, Big Brother",
      "Magitek Infantry",
      "Search Party Captain",
      "Raise the Alarm",
    ],
    ["W"],
  );
  assert.equal(result.slug, "mono-white-clowns");
});


test("Clowning Around overrides the White Weenie shell", () => {
  const clowns = classifyDeck(
    [
      "Clowning Around",
      "Leonardo, Big Brother",
      "Martyr's Soul",
      "Novice Inspector",
      "Thraben Inspector",
      "Salt Road Packbeast",
      "Search Party Captain",
      "Ramosian Rally",
      "Ancient Den",
    ],
    ["W"],
  );
  assert.equal(clowns.slug, "mono-white-clowns");

  const weenie = classifyDeck(
    [
      "Leonardo, Big Brother",
      "Martyr's Soul",
      "Novice Inspector",
      "Thraben Inspector",
      "Salt Road Packbeast",
      "Search Party Captain",
      "Ramosian Rally",
      "Ancient Den",
    ],
    ["W"],
  );
  assert.equal(weenie.slug, "white-weenie");
});


test("classifies Esper Faeries", () => {
  const result = classifyDeck(
    [
      "Spellstutter Sprite",
      "Faerie Seer",
      "Ninja of the Deep Hours",
      "Moon-Circuit Hacker",
      "Counterspell",
      "Brainstorm",
      "Snuff Out",
      "Castigate",
    ],
    ["W", "U", "B"],
  );
  assert.equal(result.slug, "esper-faeries");
});

test("classifies Sultai Control", () => {
  const result = classifyDeck(
    [
      "Abjure",
      "Coiling Oracle",
      "Wormfang Drake",
      "Murmuring Mystic",
      "Hard Evidence",
      "Cryogen Relic",
      "Counterspell",
      "Brainstorm",
    ],
    ["U", "B", "G"],
  );
  assert.equal(result.slug, "sultai-control");
});

test("classifies Dimir Artifact Control from food and Rod shells", () => {
  const food = classifyDeck(
    [
      "Ichor Wellspring",
      "Lembas",
      "Fanatical Offering",
      "Eviscerator's Insight",
      "Campfire",
      "Cast Down",
      "Counterspell",
    ],
    ["U", "B"],
  );
  assert.equal(food.slug, "dimir-artifact-control");

  const rod = classifyDeck(
    [
      "Black Mage's Rod",
      "Tandem Lookout",
      "Sewer-veillance Cam",
      "Augur of Bolas",
      "Sneaky Snacker",
      "Cast Down",
      "Counterspell",
      "Ghostly Flicker",
    ],
    ["U", "B"],
  );
  assert.equal(rod.slug, "dimir-artifact-control");
});

test("Dimir Artifact Control leaves Affinity decks alone", () => {
  const result = classifyDeck(
    [
      "Thoughtcast",
      "Myr Enforcer",
      "Glint Hawk",
      "Ichor Wellspring",
      "Lembas",
      "Fanatical Offering",
      "Eviscerator's Insight",
      "Galvanic Blast",
    ],
    ["W", "U", "B"],
  );
  assert.notEqual(result.slug, "dimir-artifact-control");
});

test("classifies Dimir Abjure", () => {
  const result = classifyDeck(
    [
      "Abjure",
      "Murmuring Mystic",
      "Sneaky Snacker",
      "Hard Evidence",
      "Cryogen Relic",
      "Cast Down",
      "Counterspell",
      "Lórien Revealed",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "dimir-abjure");
});


test("Dimir Terror needs a Terror creature, not The Modern Age", () => {
  const terror = classifyDeck(
    [
      "Tolarian Terror",
      "Cast Down",
      "Counterspell",
      "Brainstorm",
      "Sneaky Snacker",
    ],
    ["U", "B"],
  );
  assert.equal(terror.slug, "dimir-terror");

  const modernAge = classifyDeck(
    [
      "The Modern Age",
      "Cast Down",
      "Counterspell",
      "Brainstorm",
      "Sneaky Snacker",
    ],
    ["U", "B"],
  );
  assert.notEqual(modernAge.slug, "dimir-terror");
});

test("classifies Dimir Serpentine Curve", () => {
  const result = classifyDeck(
    [
      "Serpentine Curve",
      "Accumulated Knowledge",
      "Pieces of the Puzzle",
      "Frantic Inventory",
      "Wretched Banquet",
      "Drown in Sorrow",
      "Sneaky Snacker",
      "Brainstorm",
      "Cast Down",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "dimir-serpentine-curve");
});

test("classifies the Mystic/Thorn flavor as Dimir Control", () => {
  const result = classifyDeck(
    [
      "Augur of Bolas",
      "Murmuring Mystic",
      "Thorn of the Black Rose",
      "Agony Warp",
      "Brainstorm",
      "Cast Down",
      "Counterspell",
      "Lórien Revealed",
      "Mystical Teachings",
      "Ponder",
      "Snuff Out",
      "Stream of Thought",
      "Campfire",
    ],
    ["U", "B"],
  );
  assert.equal(result.slug, "ub-control");
});

test("archetypeName returns a human label or the slug", () => {
  assert.equal(archetypeName("delver"), "Mono-Blue Delver");
  assert.equal(archetypeName("wall-spy-combo"), "Walls Spy Combo");
  assert.equal(archetypeName("not-a-real-slug"), "not-a-real-slug");
});
