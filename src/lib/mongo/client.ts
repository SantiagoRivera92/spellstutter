import "server-only";
import { MongoClient, type Db } from "mongodb";
import { MONGODB_DB, requireEnv } from "@/lib/env";

interface MongoCache {
  clientPromise: Promise<MongoClient> | null;
  dbName: string | null;
}

const globalForMongo = globalThis as unknown as { __spellstutterMongo?: MongoCache };

const cache: MongoCache =
  globalForMongo.__spellstutterMongo ?? { clientPromise: null, dbName: null };

if (process.env.NODE_ENV !== "production") {
  globalForMongo.__spellstutterMongo = cache;
}

export async function getDb(): Promise<Db> {
  if (!cache.clientPromise) {
    const uri = requireEnv("MONGODB_URI");
    const client = new MongoClient(uri, {
      appName: "spellstutter",
      maxPoolSize: 10,
    });
    cache.dbName = MONGODB_DB;
    // If the initial connection fails (transient Atlas outage, an IP allowlist
    // that has not propagated yet), drop the cached promise so the next
    // request retries instead of awaiting one dead promise forever.
    cache.clientPromise = client.connect().catch((error: unknown) => {
      cache.clientPromise = null;
      void client.close().catch(() => {});
      throw error;
    });
  }
  try {
    const client = await cache.clientPromise;
    return client.db(cache.dbName ?? MONGODB_DB);
  } catch (error) {
    cache.clientPromise = null;
    throw error;
  }
}

export const COLLECTIONS = {
  cards: "cards",
  printings: "printings",
  events: "metagame_events",
  decks: "metagame_decks",
  endstepArchetypes: "endstep_archetypes",
  endstepMatchups: "endstep_matchups",
  syncRuns: "sync_runs",
} as const;
