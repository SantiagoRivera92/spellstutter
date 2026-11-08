import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

const AUTHORIZE_URL = "https://www.patreon.com/oauth2/authorize";
const TOKEN_URL = "https://www.patreon.com/api/oauth2/token";
const IDENTITY_URL = "https://www.patreon.com/api/oauth2/v2/identity";

export function patreonRedirectUri(origin: string): string {
  return (
    process.env.PATREON_REDIRECT_URI?.trim() ||
    `${origin}/api/patreon/callback`
  );
}

export function patreonAuthorizeUrl(state: string, redirectUri: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requireEnv("PATREON_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "identity identity.memberships");
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export async function exchangePatreonCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: requireEnv("PATREON_CLIENT_ID"),
    client_secret: requireEnv("PATREON_CLIENT_SECRET"),
    redirect_uri: redirectUri,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Patreon token exchange failed: ${response.status}`);
  }
  const data = (await response.json()) as TokenResponse;
  if (!data.access_token) throw new Error("Patreon returned no access token");
  return data.access_token;
}

interface JsonApiResource {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    { data?: { id: string; type: string } | { id: string; type: string }[] | null }
  >;
}

interface JsonApiDocument {
  data?: JsonApiResource;
  included?: JsonApiResource[];
}

function relationshipIds(resource: JsonApiResource, key: string): string[] {
  const data = resource.relationships?.[key]?.data;
  if (!data) return [];
  return Array.isArray(data) ? data.map((entry) => entry.id) : [data.id];
}

export interface PatreonSupport {
  patreonUserId: string;
  campaignId: string | null;
  tierId: string | null;
  tierTitle: string | null;
  patronStatus: string;
  amountCents: number;
}

/**
 * Fetch the signed-in Patreon identity and pick the membership for this
 * creator's campaign. Returns `patronStatus: "not_member"` when the user has
 * a Patreon account but no membership on the configured campaign.
 */
export async function fetchPatreonSupport(
  accessToken: string,
): Promise<PatreonSupport | null> {
  const campaignId = requireEnv("PATREON_CAMPAIGN_ID");
  const url = new URL(IDENTITY_URL);
  url.searchParams.set(
    "include",
    "memberships,memberships.campaign,memberships.currently_entitled_tiers",
  );
  url.searchParams.set("fields[user]", "full_name,email");
  url.searchParams.set(
    "fields[member]",
    "patron_status,currently_entitled_amount_cents,last_charge_status",
  );
  url.searchParams.set("fields[tier]", "title,amount_cents");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Patreon identity request failed: ${response.status}`);
  }

  const document = (await response.json()) as JsonApiDocument;
  const user = document.data;
  if (!user) return null;

  const included = document.included ?? [];
  const memberships = relationshipIds(user, "memberships")
    .map((id) => included.find((entry) => entry.type === "member" && entry.id === id))
    .filter((entry): entry is JsonApiResource => Boolean(entry));

  const membership = memberships.find((entry) =>
    relationshipIds(entry, "campaign").includes(campaignId),
  );

  if (!membership) {
    return {
      patreonUserId: user.id,
      campaignId: null,
      tierId: null,
      tierTitle: null,
      patronStatus: "not_member",
      amountCents: 0,
    };
  }

  const attributes = membership.attributes ?? {};
  const tierRefs = relationshipIds(
    membership,
    "currently_entitled_tiers",
  );
  const tier = included.find(
    (entry) => entry.type === "tier" && entry.id === tierRefs[0],
  );

  return {
    patreonUserId: user.id,
    campaignId: relationshipIds(membership, "campaign")[0] ?? null,
    tierId: tier?.id ?? null,
    tierTitle:
      typeof tier?.attributes?.title === "string"
        ? tier.attributes.title
        : null,
    patronStatus:
      typeof attributes.patron_status === "string"
        ? attributes.patron_status
        : "unknown",
    amountCents:
      typeof attributes.currently_entitled_amount_cents === "number"
        ? attributes.currently_entitled_amount_cents
        : 0,
  };
}

export function verifyPatreonWebhook(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.PATREON_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = createHmac("md5", secret).update(rawBody).digest("hex");
  const provided = signature.trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(provided, "utf8"),
    );
  } catch {
    return false;
  }
}

export interface PatreonWebhookMember {
  patreonUserId: string | null;
  campaignId: string | null;
  tierId: string | null;
  tierTitle: string | null;
  patronStatus: string;
  amountCents: number;
}

/** Parse a `members:*` webhook payload into the fields we store. */
export function parsePatreonMemberWebhook(
  payload: unknown,
  deleted = false,
): PatreonWebhookMember | null {
  const document = payload as JsonApiDocument;
  const member = document.data;
  if (!member || member.type !== "member") return null;

  const included = document.included ?? [];
  const tierIds = relationshipIds(member, "currently_entitled_tiers");
  const tier = included.find(
    (entry) => entry.type === "tier" && entry.id === tierIds[0],
  );
  const attributes = member.attributes ?? {};

  return {
    patreonUserId: relationshipIds(member, "user")[0] ?? null,
    campaignId: relationshipIds(member, "campaign")[0] ?? null,
    tierId: tier?.id ?? tierIds[0] ?? null,
    tierTitle:
      typeof tier?.attributes?.title === "string"
        ? tier.attributes.title
        : null,
    patronStatus: deleted
      ? "former_patron"
      : typeof attributes.patron_status === "string"
        ? attributes.patron_status
        : "unknown",
    amountCents: deleted
      ? 0
      : typeof attributes.currently_entitled_amount_cents === "number"
        ? attributes.currently_entitled_amount_cents
        : 0,
  };
}
