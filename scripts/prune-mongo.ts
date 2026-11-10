/**
 * One-time/maintenance cleanup for fields and indexes the app no longer uses.
 *
 * Usage:
 *   pnpm prune:mongo            # dry run, prints stats and planned changes
 *   pnpm prune:mongo -- --apply # apply
 */
import { config } from "dotenv";
import { MongoClient } from "mongodb";

config({ path: ".env.local" });
config();

const DROP_INDEXES: { collection: string; index: string }[] = [
  { collection: "cards", index: "name_text_oracle_text_text" },
  { collection: "cards", index: "legalities.pauper_1" },
  { collection: "printings", index: "oracle_id_1_rarity_1_released_at_1" },
  { collection: "metagame_decks", index: "sideboard.oracle_id_1" },
];

async function stats(client: MongoClient, dbName: string) {
  const db = client.db(dbName);
  for (const name of [
    "cards",
    "printings",
    "metagame_decks",
    "endstep_archetypes",
  ]) {
    const s = await db.command({ collStats: name });
    console.log(
      `${name.padEnd(20)} size=${(s.size / 1024 / 1024).toFixed(1)}MB storage=${(s.storageSize / 1024 / 1024).toFixed(1)}MB index=${(s.totalIndexSize / 1024 / 1024).toFixed(1)}MB`,
    );
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? "spellstutter";
  if (!uri) throw new Error("MONGODB_URI missing");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    console.log(apply ? "Applying cleanup" : "Dry run — pass --apply to write");
    console.log("\nBefore:");
    await stats(client, dbName);

    console.log("\nDropping unused indexes:");
    for (const { collection, index } of DROP_INDEXES) {
      console.log(`- ${collection}.${index}`);
      if (apply) {
        await db.collection(collection).dropIndex(index).catch(() => {});
      }
    }

    console.log("\nRemoving unused fields:");
    if (apply) {
      await db.collection("metagame_decks").updateMany(
        {},
        { $unset: { "mainboard.$[card].image": "" } },
        { arrayFilters: [{ "card.image": { $exists: true } }] },
      );
      await db.collection("metagame_decks").updateMany(
        {},
        { $unset: { "sideboard.$[card].image": "" } },
        { arrayFilters: [{ "card.image": { $exists: true } }] },
      );
      await db.collection("metagame_decks").updateMany(
        {},
        { $unset: { reclassified_at: "" } },
      );

      await db.collection("cards").updateMany(
        {},
        [
          {
            $set: {
              legalities: { pauper: "$legalities.pauper" },
            },
          },
        ],
      );
      await db.collection("cards").updateMany(
        {},
        {
          $unset: {
            "image_uris.small": "",
            "image_uris.large": "",
          },
        },
      );
      await db.collection("cards").updateMany(
        { card_faces: { $type: "array" } },
        {
          $unset: {
            "card_faces.$[].image_uris.small": "",
            "card_faces.$[].image_uris.large": "",
          },
        },
      );
      await db.collection("printings").updateMany(
        {},
        {
          $unset: {
            "image_uris.large": "",
            finishes: "",
            promo: "",
          },
        },
      );
      await db.collection("printings").updateMany(
        { card_faces: { $type: "array" } },
        { $unset: { "card_faces.$[].image_uris.large": "" } },
      );
      await db.collection("endstep_archetypes").updateMany(
        {},
        { $unset: { matchups: "" } },
      );
    }

    console.log("\nAfter:");
    await stats(client, dbName);
    console.log(
      "\nRun `db.runCommand({ compact: '<collection>' })` on a self-hosted MongoDB if you need to reclaim file space; Atlas manages this automatically over time.",
    );
  } finally {
    await client.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
