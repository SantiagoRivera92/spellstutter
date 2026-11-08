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
  {
    card_name: "Lightning Bolt",
    quantity: 4,
    board: "main" as const,
    tcgplayer_product_id: null,
  },
  {
    card_name: "Island",
    quantity: 18,
    board: "main" as const,
    tcgplayer_product_id: null,
  },
];

const cardsWithIds = [
  { ...cards[0], tcgplayer_product_id: 111 },
  { ...cards[1], tcgplayer_product_id: 222 },
];

function massEntryLinesFromHref(href: string): string {
  const outer = new URL(href);
  const destination = outer.searchParams.get("u");
  assert.ok(destination);
  return new URL(destination).searchParams.get("c") ?? "";
}

test("affiliate links are hidden when disabled", () => {
  withEnv({ AFFILIATE_TCGPLAYER_URL: "https://example.com/buy" }, () => {
    assert.deepEqual(deckBuyLinks(cards), []);
    assert.equal(affiliateDisclosure(), null);
  });
});

test("TCGplayer links fall back to card names without product ids", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      AFFILIATE_LINKS_ENABLED: "true",
      AFFILIATE_TCGPLAYER_URL: "https://partner.tcgplayer.com/spellbook",
      AFFILIATE_MANAPOOL_URL: "https://manapool.com/?ref=shardless",
    },
    () => {
      const [tcgplayer, manapool] = deckBuyLinks(cards);
      assert.equal(tcgplayer.label, "TCGplayer");
      assert.match(tcgplayer.href, /^https:\/\/partner\.tcgplayer\.com\/spellbook\?u=/);
      assert.equal(massEntryLinesFromHref(tcgplayer.href), "4 Lightning Bolt\n18 Island");
      assert.deepEqual(manapool, {
        label: "ManaPool",
        href: "https://manapool.com/?ref=shardless",
      });
      assert.match(affiliateDisclosure() ?? "", /affiliate links/);
    },
  );
});

test("TCGplayer mass entry uses product ids when every card has one", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      AFFILIATE_LINKS_ENABLED: "true",
      AFFILIATE_TCGPLAYER_URL: "https://partner.tcgplayer.com/spellbook",
    },
    () => {
      const [tcgplayer] = deckBuyLinks(cardsWithIds);
      assert.equal(massEntryLinesFromHref(tcgplayer.href), "4-111\n18-222");
    },
  );
});

test("deck buy template receives cards and ids", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      AFFILIATE_LINKS_ENABLED: "true",
      AFFILIATE_TCGPLAYER_URL: "https://partner.tcgplayer.com/spellbook",
      AFFILIATE_DECK_BUY_URL_TEMPLATE:
        "https://example.com/mass?cards={cards}&ids={ids}",
    },
    () => {
      const [link] = deckBuyLinks(cardsWithIds);
      const url = new URL(link.href);
      assert.equal(
        url.searchParams.get("cards"),
        "4-111\n18-222",
      );
      assert.equal(url.searchParams.get("ids"), "4-111\n18-222");
    },
  );
});
