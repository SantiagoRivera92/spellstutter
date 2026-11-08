import { test } from "node:test";
import assert from "node:assert/strict";
import { affiliateDisclosure, deckBuyLinks } from "./affiliate";

const KEYS = [
  "MONETIZATION_ENABLED",
  "AFFILIATE_LINKS_ENABLED",
  "AFFILIATE_TCGPLAYER_URL",
  "AFFILIATE_MANAPOOL_URL",
  "AFFILIATE_CARDKINGDOM_URL",
  "AFFILIATE_DECK_BUY_URL_TEMPLATE",
];

function withEnv(values: Record<string, string>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  try {
    fn();
  } finally {
    for (const key of KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const cards = [
  { card_name: "Lightning Bolt", quantity: 4, board: "main" as const },
  { card_name: "Island", quantity: 18, board: "main" as const },
];

test("affiliate links are hidden when disabled", () => {
  withEnv({ AFFILIATE_TCGPLAYER_URL: "https://example.com/buy" }, () => {
    assert.deepEqual(deckBuyLinks(cards), []);
    assert.equal(affiliateDisclosure(), null);
  });
});

test("affiliate links use the configured partner urls", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      AFFILIATE_LINKS_ENABLED: "true",
      AFFILIATE_TCGPLAYER_URL: "https://partner.tcgplayer.com/spellbook",
      AFFILIATE_MANAPOOL_URL: "https://manapool.com/?ref=shardless",
    },
    () => {
      assert.deepEqual(deckBuyLinks(cards), [
        {
          label: "TCGplayer",
          href: "https://partner.tcgplayer.com/spellbook",
        },
        {
          label: "ManaPool",
          href: "https://manapool.com/?ref=shardless",
        },
      ]);
      assert.match(affiliateDisclosure() ?? "", /affiliate links/);
    },
  );
});

test("deck buy template receives the encoded card list", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      AFFILIATE_LINKS_ENABLED: "true",
      AFFILIATE_TCGPLAYER_URL: "https://partner.tcgplayer.com/spellbook",
      AFFILIATE_DECK_BUY_URL_TEMPLATE:
        "https://example.com/mass?cards={cards}",
    },
    () => {
      const [link] = deckBuyLinks(cards);
      assert.equal(
        link.href,
        `https://example.com/mass?cards=${encodeURIComponent(
          "4 Lightning Bolt\n18 Island",
        )}`,
      );
    },
  );
});
