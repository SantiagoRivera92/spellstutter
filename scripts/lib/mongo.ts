import { MongoClient, type Db } from "mongodb";

export function mongoConfig() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. See .env.example.");
  }
  return { uri, dbName: process.env.MONGODB_DB ?? "spellstutter" };
}

export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const { uri, dbName } = mongoConfig();
  const client = new MongoClient(uri, { appName: "spellstutter-sync" });
  try {
    await client.connect();
    return await fn(client.db(dbName));
  } finally {
    await client.close();
  }
}

export function scryfallHeaders(): Record<string, string> {
  return {
    "User-Agent":
      process.env.SCRYFALL_USER_AGENT ??
      "spellstutter/0.1 (+https://github.com/spellstutter)",
    Accept: "application/json",
  };
}
