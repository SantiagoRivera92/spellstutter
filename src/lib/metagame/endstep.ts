import "server-only";
import { COLLECTIONS, getDb } from "@/lib/mongo/client";
import type {
  EndstepArchetype,
  EndstepArchetypeOption,
} from "./types";

// `_id` is an ObjectId and cannot cross the Server/Client boundary.
const WITHOUT_ID = { projection: { _id: 0 } } as const;

const DEFAULT_FORMAT = "Pauper";

/** Archetypes for a deckbuilding picker, most-played first. */
export async function listEndstepArchetypes(
  formatId: string = DEFAULT_FORMAT,
  limit = 400,
): Promise<EndstepArchetypeOption[]> {
  const db = await getDb();
  return db
    .collection<EndstepArchetype>(COLLECTIONS.endstepArchetypes)
    .find(
      // Only archetypes with a public sample list can seed a deck.
      { format_id: formatId, "sample_list.main.0": { $exists: true } },
      {
        projection: {
          _id: 0,
          slug: 1,
          name: 1,
          colours: 1,
          key_cards: 1,
          share_rate: 1,
          players: 1,
          art: 1,
        },
      },
    )
    .sort({ share_rate: -1 })
    .limit(limit)
    .toArray() as Promise<EndstepArchetypeOption[]>;
}

/** A single endstep archetype with its sample list and card statistics. */
export async function getEndstepArchetype(
  slug: string,
  formatId: string = DEFAULT_FORMAT,
): Promise<EndstepArchetype | null> {
  const db = await getDb();
  return db
    .collection<EndstepArchetype>(COLLECTIONS.endstepArchetypes)
    .findOne({ format_id: formatId, slug }, WITHOUT_ID);
}

/** Endstep archetypes that include the given card in their sample list. */
export async function getEndstepArchetypesForCard(
  cardName: string,
  formatId: string = DEFAULT_FORMAT,
): Promise<EndstepArchetypeOption[]> {
  const db = await getDb();
  return db
    .collection<EndstepArchetype>(COLLECTIONS.endstepArchetypes)
    .find(
      { format_id: formatId, "sample_list.main.name": cardName },
      {
        projection: {
          _id: 0,
          slug: 1,
          name: 1,
          colours: 1,
          key_cards: 1,
          share_rate: 1,
          players: 1,
          art: 1,
        },
      },
    )
    .sort({ share_rate: -1 })
    .limit(50)
    .toArray() as Promise<EndstepArchetypeOption[]>;
}
