import "server-only";
import { MongoClient, type Db } from "mongodb";
import { cache } from "react";
import { after } from "next/server";
import { MONGODB_DB, requireEnv } from "@/lib/env";

/**
 * Workers cannot reuse an I/O object (including a MongoClient socket) across
 * requests. Keep the pooled client on Node hosts, but create and close a
 * request-scoped client when running on Cloudflare.
 */
const isCloudflareWorkers =
  typeof navigator !== "undefined" &&
  navigator.userAgent === "Cloudflare-Workers";

interface MongoCache {
  clientPromise: Promise<MongoClient> | null;
  dbName: string | null;
}

const globalForMongo = globalThis as unknown as { __spellstutterMongo?: MongoCache };

const cacheStore: MongoCache =
  globalForMongo.__spellstutterMongo ?? { clientPromise: null, dbName: null };

if (process.env.NODE_ENV !== "production") {
  globalForMongo.__spellstutterMongo = cacheStore;
}

async function connectClient(): Promise<MongoClient> {
  const uri = requireEnv("MONGODB_URI");
  const client = new MongoClient(uri, {
    appName: "spellstutter",
    maxPoolSize: isCloudflareWorkers ? 5 : 10,
  });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

/**
 * React's `cache` scopes this to a single server request, so one Worker request
 * shares one connection. `after` closes it once the response has been sent.
 */
const getWorkersDb = cache(async (): Promise<Db> => {
  const client = await connectClient();
  after(async () => {
    await client.close().catch(() => {});
  });
  return client.db(MONGODB_DB);
});

export async function getDb(): Promise<Db> {
  if (isCloudflareWorkers) {
    return getWorkersDb();
  }

  if (!cacheStore.clientPromise) {
    cacheStore.dbName = MONGODB_DB;
    // If the initial connection fails (transient Atlas outage, an IP allowlist
    // that has not propagated yet), drop the cached promise so the next
    // request retries instead of awaiting one dead promise forever.
    cacheStore.clientPromise = connectClient().catch((error: unknown) => {
      cacheStore.clientPromise = null;
      throw error;
    });
  }
  try {
    const client = await cacheStore.clientPromise;
    return client.db(cacheStore.dbName ?? MONGODB_DB);
  } catch (error) {
    cacheStore.clientPromise = null;
    throw error;
  }
}

/** Close the pooled Node client. Used by tests and graceful shutdown. */
export async function closeDb(): Promise<void> {
  const pending = cacheStore.clientPromise;
  cacheStore.clientPromise = null;
  cacheStore.dbName = null;
  if (!pending) return;
  const client = await pending.catch(() => null);
  await client?.close().catch(() => {});
}

export const COLLECTIONS = {
  cards: "cards",
  printings: "printings",
  events: "metagame_events",
  decks: "metagame_decks",
  meleeMatches: "melee_matches",
  endstepArchetypes: "endstep_archetypes",
  endstepMatchups: "endstep_matchups",
  syncRuns: "sync_runs",
} as const;
