import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;
let dbName: string | null = null;

export function hasTestMongo(): boolean {
  return Boolean(process.env.MONGODB_TEST_URI);
}

/**
 * Point the app's Mongo helpers at a throwaway database, then return it.
 * Call this before dynamically importing any module that reads MONGODB_DB.
 */
export async function connectTestDb(prefix: string): Promise<Db> {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error("MONGODB_TEST_URI is not set");

  dbName = `spellstutter_test_${prefix}_${process.pid}_${Date.now()}`;
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = dbName;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function resetTestDb(): Promise<void> {
  if (db) await db.dropDatabase();
}

export async function closeTestDb(): Promise<void> {
  if (client) await client.close();
  client = null;
  db = null;
  dbName = null;
}

export function testDbName(): string | null {
  return dbName;
}
