import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchPatreonSupport,
  parsePatreonMemberWebhook,
  patreonAuthorizeUrl,
  verifyPatreonWebhook,
} from "./patreon";
import { createHmac } from "node:crypto";

const KEYS = [
  "PATREON_CLIENT_ID",
  "PATREON_CLIENT_SECRET",
  "PATREON_CAMPAIGN_ID",
  "PATREON_REDIRECT_URI",
  "PATREON_WEBHOOK_SECRET",
];

function withEnv(values: Record<string, string>, fn: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  return fn().finally(() => {
    for (const key of KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function mockFetch(document: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(document), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  return () => {
    globalThis.fetch = original;
  };
}

const campaign = "campaign-1";

function identityDocument(campaignId: string) {
  return {
    data: {
      id: "patreon-user",
      type: "user",
      relationships: {
        memberships: {
          data: [{ id: "member-1", type: "member" }],
        },
      },
    },
    included: [
      {
        id: "member-1",
        type: "member",
        attributes: {
          patron_status: "active_patron",
          currently_entitled_amount_cents: 500,
        },
        relationships: {
          campaign: { data: { id: campaignId, type: "campaign" } },
          currently_entitled_tiers: {
            data: [{ id: "tier-1", type: "tier" }],
          },
        },
      },
      {
        id: "tier-1",
        type: "tier",
        attributes: { title: "Acolyte", amount_cents: 500 },
      },
    ],
  };
}

test("patreon authorize url includes scopes and state", async () => {
  await withEnv({ PATREON_CLIENT_ID: "client" }, async () => {
    const url = new URL(patreonAuthorizeUrl("state-1", "https://site/cb"));
    assert.equal(url.searchParams.get("client_id"), "client");
    assert.equal(url.searchParams.get("state"), "state-1");
    assert.equal(url.searchParams.get("redirect_uri"), "https://site/cb");
    assert.match(url.searchParams.get("scope") ?? "", /identity\.memberships/);
  });
});

test("patreon membership is matched to the configured campaign", async () => {
  const restore = mockFetch(identityDocument(campaign));
  try {
    await withEnv({ PATREON_CAMPAIGN_ID: campaign }, async () => {
      const support = await fetchPatreonSupport("token");
      assert.equal(support?.patreonUserId, "patreon-user");
      assert.equal(support?.campaignId, campaign);
      assert.equal(support?.patronStatus, "active_patron");
      assert.equal(support?.amountCents, 500);
      assert.equal(support?.tierId, "tier-1");
      assert.equal(support?.tierTitle, "Acolyte");
    });
  } finally {
    restore();
  }
});

test("memberships for other campaigns are reported as not_member", async () => {
  const restore = mockFetch(identityDocument("other-campaign"));
  try {
    await withEnv({ PATREON_CAMPAIGN_ID: campaign }, async () => {
      const support = await fetchPatreonSupport("token");
      assert.equal(support?.patronStatus, "not_member");
      assert.equal(support?.amountCents, 0);
    });
  } finally {
    restore();
  }
});

test("patreon webhook signatures are verified with HMAC-MD5", async () => {
  await withEnv({ PATREON_WEBHOOK_SECRET: "secret" }, async () => {
    const body = '{"data":{"type":"member"}}';
    const signature = createHmac("md5", "secret").update(body).digest("hex");
    assert.equal(verifyPatreonWebhook(body, signature), true);
    assert.equal(verifyPatreonWebhook(body, "bad"), false);
    assert.equal(verifyPatreonWebhook(body, null), false);
  });
});

test("member webhooks parse user, campaign, tier and status", () => {
  const member = parsePatreonMemberWebhook({
    data: {
      id: "member-1",
      type: "member",
      attributes: {
        patron_status: "active_patron",
        currently_entitled_amount_cents: 1000,
      },
      relationships: {
        user: { data: { id: "patreon-user", type: "user" } },
        campaign: { data: { id: "campaign-1", type: "campaign" } },
        currently_entitled_tiers: {
          data: [{ id: "tier-1", type: "tier" }],
        },
      },
    },
    included: [
      { id: "tier-1", type: "tier", attributes: { title: "Mage" } },
    ],
  });

  assert.deepEqual(member, {
    patreonUserId: "patreon-user",
    campaignId: "campaign-1",
    tierId: "tier-1",
    tierTitle: "Mage",
    patronStatus: "active_patron",
    amountCents: 1000,
  });
});

test("deleted memberships revoke supporter status", () => {
  const member = parsePatreonMemberWebhook(
    {
      data: {
        id: "member-1",
        type: "member",
        attributes: { patron_status: "active_patron" },
        relationships: {
          user: { data: { id: "patreon-user", type: "user" } },
          campaign: { data: { id: "campaign-1", type: "campaign" } },
        },
      },
    },
    true,
  );
  assert.equal(member?.patronStatus, "former_patron");
  assert.equal(member?.amountCents, 0);
});
