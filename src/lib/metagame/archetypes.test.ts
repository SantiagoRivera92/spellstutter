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

test("archetypeName returns a human label or the slug", () => {
  assert.equal(archetypeName("delver"), "Mono-Blue Delver");
  assert.equal(archetypeName("not-a-real-slug"), "not-a-real-slug");
});
