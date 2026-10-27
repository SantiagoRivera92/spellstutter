import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventSourceName,
  isCardsrealmEvent,
  isMeleeEvent,
  isMtgtop8Event,
} from "./event-source";

test("identifies Melee events by slug or URL", () => {
  assert.equal(
    isMeleeEvent({ slug: "melee-474840", url: "https://melee.gg/Tournament/View/474840" }),
    true,
  );
  assert.equal(
    isMeleeEvent({ slug: "other", url: "https://melee.gg/Tournament/View/474840" }),
    true,
  );
  assert.equal(isMeleeEvent({ slug: "melee-474840", url: "https://example.com" }), true);
});

test("identifies Cardsrealm events by slug or URL", () => {
  assert.equal(
    isCardsrealmEvent({
      slug: "cardsrealm-810890",
      url: "https://cardsrealm.com/tournament/en-us/1k3e2-meeples-club-pauper-193",
    }),
    true,
  );
  assert.equal(
    isCardsrealmEvent({
      slug: "other",
      url: "https://cardsrealm.com/tournament/en-us/1k3e2-meeples-club-pauper-193",
    }),
    true,
  );
});

test("identifies MTGTop8 events by slug or URL", () => {
  assert.equal(
    isMtgtop8Event({
      slug: "mtgtop8-92876",
      url: "https://www.mtgtop8.com/event?e=92876&f=PAU",
    }),
    true,
  );
  assert.equal(
    isMtgtop8Event({
      slug: "other",
      url: "https://www.mtgtop8.com/event?e=92876&f=PAU",
    }),
    true,
  );
});

test("identifies non-Melee, non-Cardsrealm, non-MTGTop8 events as MTGO", () => {
  assert.equal(
    isMeleeEvent({ slug: "pauper-league-123", url: "https://www.mtgo.com/decklist/123" }),
    false,
  );
  assert.equal(
    isCardsrealmEvent({
      slug: "pauper-league-123",
      url: "https://www.mtgo.com/decklist/123",
    }),
    false,
  );
  assert.equal(
    eventSourceName({ slug: "pauper-league-123", url: "https://www.mtgo.com/decklist/123" }),
    "MTGO",
  );
  assert.equal(
    eventSourceName({
      slug: "mtgtop8-92876",
      url: "https://www.mtgtop8.com/event?e=92876&f=PAU",
    }),
    "MTGTop8",
  );
});

test("names the event source", () => {
  assert.equal(
    eventSourceName({ slug: "melee-474840", url: "https://melee.gg/Tournament/View/474840" }),
    "melee.gg",
  );
  assert.equal(
    eventSourceName({
      slug: "cardsrealm-810890",
      url: "https://cardsrealm.com/tournament/en-us/1k3e2-meeples-club-pauper-193",
    }),
    "Cardsrealm",
  );
});
