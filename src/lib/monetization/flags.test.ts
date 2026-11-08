import { test } from "node:test";
import assert from "node:assert/strict";
import {
  donationLabel,
  donationUrl,
  isAffiliateEnabled,
  isDonationsEnabled,
  isMonetizationEnabled,
  isPatreonOAuthEnabled,
  isPremiumGatingEnabled,
  supportProvider,
} from "./flags";

const KEYS = [
  "MONETIZATION_ENABLED",
  "AFFILIATE_LINKS_ENABLED",
  "DONATIONS_ENABLED",
  "PREMIUM_GATING_ENABLED",
  "SUPPORT_PROVIDER",
  "PATREON_URL",
  "PATREON_CLIENT_ID",
  "PATREON_CLIENT_SECRET",
  "PATREON_CAMPAIGN_ID",
  "DONATION_URL",
  "DONATION_LABEL",
];

function withEnv(values: Record<string, string>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
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

test("monetization is disabled by default", () => {
  withEnv({}, () => {
    assert.equal(isMonetizationEnabled(), false);
    assert.equal(isAffiliateEnabled(), false);
    assert.equal(isDonationsEnabled(), false);
    assert.equal(supportProvider(), "none");
    assert.equal(donationUrl(), null);
  });
});

test("support sub-features require the master switch", () => {
  withEnv(
    { DONATIONS_ENABLED: "true", PATREON_URL: "https://patreon.com/x" },
    () => {
      assert.equal(isDonationsEnabled(), false);
    },
  );
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      DONATIONS_ENABLED: "true",
      PATREON_URL: "https://patreon.com/x",
    },
    () => {
      assert.equal(isDonationsEnabled(), true);
    },
  );
});

test("patreon is the default support provider when a URL is set", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      DONATIONS_ENABLED: "true",
      PATREON_URL: "https://patreon.com/spellstutter",
    },
    () => {
      assert.equal(supportProvider(), "patreon");
      assert.equal(donationUrl(), "https://patreon.com/spellstutter");
      assert.equal(donationLabel(), "Support on Patreon");
    },
  );
});

test("custom support links still work", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      DONATIONS_ENABLED: "true",
      SUPPORT_PROVIDER: "custom",
      DONATION_URL: "https://example.com/tip",
      DONATION_LABEL: "Tip jar",
    },
    () => {
      assert.equal(donationUrl(), "https://example.com/tip");
      assert.equal(donationLabel(), "Tip jar");
    },
  );
});

test("patreon oauth needs all credentials", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      SUPPORT_PROVIDER: "patreon",
      PATREON_CLIENT_ID: "client",
    },
    () => {
      assert.equal(isPatreonOAuthEnabled(), false);
    },
  );
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      SUPPORT_PROVIDER: "patreon",
      PATREON_CLIENT_ID: "client",
      PATREON_CLIENT_SECRET: "secret",
      PATREON_CAMPAIGN_ID: "123",
    },
    () => {
      assert.equal(isPatreonOAuthEnabled(), true);
    },
  );
});

test("premium gating requires monetization and Patreon OAuth", () => {
  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      SUPPORT_PROVIDER: "patreon",
      PREMIUM_GATING_ENABLED: "true",
    },
    () => {
      // No OAuth credentials means we cannot verify supporters, so stay open.
      assert.equal(isPremiumGatingEnabled(), false);
    },
  );

  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      SUPPORT_PROVIDER: "patreon",
      PREMIUM_GATING_ENABLED: "true",
      PATREON_CLIENT_ID: "client",
      PATREON_CLIENT_SECRET: "secret",
      PATREON_CAMPAIGN_ID: "campaign",
    },
    () => {
      assert.equal(isPremiumGatingEnabled(), true);
    },
  );

  withEnv(
    {
      MONETIZATION_ENABLED: "true",
      SUPPORT_PROVIDER: "patreon",
      PREMIUM_GATING_ENABLED: "false",
      PATREON_CLIENT_ID: "client",
      PATREON_CLIENT_SECRET: "secret",
      PATREON_CAMPAIGN_ID: "campaign",
    },
    () => {
      assert.equal(isPremiumGatingEnabled(), false);
    },
  );
});
