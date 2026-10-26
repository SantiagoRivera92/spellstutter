import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MONGODB_DB,
  getSiteBase,
  getSiteUrl,
  isMongoConfigured,
  isSupabaseConfigured,
  requireEnv,
} from "./env";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(vars)) {
    saved.set(key, process.env[key]);
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("requireEnv returns a configured value", () => {
  withEnv({ TEST_REQUIRED: "value" }, () => {
    assert.equal(requireEnv("TEST_REQUIRED"), "value");
  });
});

test("requireEnv throws for missing or empty values", () => {
  withEnv({ TEST_REQUIRED: undefined }, () => {
    assert.throws(() => requireEnv("TEST_REQUIRED"), /TEST_REQUIRED/);
  });
  withEnv({ TEST_REQUIRED: "" }, () => {
    assert.throws(() => requireEnv("TEST_REQUIRED"), /TEST_REQUIRED/);
  });
});

test("isMongoConfigured reflects MONGODB_URI", () => {
  withEnv({ MONGODB_URI: "mongodb://localhost" }, () => {
    assert.equal(isMongoConfigured(), true);
  });
  withEnv({ MONGODB_URI: undefined }, () => {
    assert.equal(isMongoConfigured(), false);
  });
  withEnv({ MONGODB_URI: "" }, () => {
    assert.equal(isMongoConfigured(), false);
  });
});

test("isSupabaseConfigured requires both URL and anon key", () => {
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    },
    () => assert.equal(isSupabaseConfigured(), true),
  );
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    },
    () => assert.equal(isSupabaseConfigured(), false),
  );
  withEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    },
    () => assert.equal(isSupabaseConfigured(), false),
  );
});

test("getSiteUrl prefers the configured origin and strips trailing slashes", () => {
  withEnv(
    {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://spellstutter.example///",
    },
    () => {
      assert.equal(getSiteUrl("http://fallback"), "https://spellstutter.example");
    },
  );
});

test("getSiteUrl falls back in development", () => {
  withEnv(
    { NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: undefined },
    () => {
      assert.equal(getSiteUrl("http://localhost:3000"), "http://localhost:3000");
    },
  );
});

test("getSiteUrl throws in production without a configured origin", () => {
  withEnv(
    { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: undefined },
    () => {
      assert.throws(() => getSiteUrl("http://fallback"), /NEXT_PUBLIC_SITE_URL/);
    },
  );
});

test("getSiteUrl treats a blank configured origin as unset", () => {
  withEnv(
    { NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "   " },
    () => {
      assert.equal(getSiteUrl("http://fallback"), "http://fallback");
    },
  );
});

test("getSiteBase uses the configured origin or localhost in development", () => {
  withEnv(
    {
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_URL: "https://spellstutter.example/",
    },
    () => assert.equal(getSiteBase(), "https://spellstutter.example"),
  );
  withEnv(
    { NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: undefined },
    () => assert.equal(getSiteBase(), "http://localhost:3000"),
  );
});

test("MONGODB_DB defaults to spellstutter", () => {
  assert.equal(MONGODB_DB, process.env.MONGODB_DB ?? "spellstutter");
});
