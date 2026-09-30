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
    cache.clientPromise = client.connect();
    cache.dbName = MONGODB_DB;
  }
  const client = await cache.clientPromise;
  return client.db(cache.dbName ?? MONGODB_DB);
}

export const COLLECTIONS = {
  cards: "cards",
  printings: "printings",
  events: "metagame_events",
  decks: "metagame_decks",
  syncRuns: "sync_runs",
} as const;
