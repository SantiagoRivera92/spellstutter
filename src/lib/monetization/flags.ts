const FALSE_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !FALSE_VALUES.has(value);
}

/**
 * Master switch. When off, the application behaves like a completely free
 * product: no support/affiliate UI and no Patreon calls.
 */
export function isMonetizationEnabled(): boolean {
  return envFlag("MONETIZATION_ENABLED");
}

/** Card-sale affiliate links. */
export function isAffiliateEnabled(): boolean {
  return isMonetizationEnabled() && envFlag("AFFILIATE_LINKS_ENABLED");
}

/** Patreon/donation support links. */
export function isDonationsEnabled(): boolean {
  return isMonetizationEnabled() && envFlag("DONATIONS_ENABLED");
}

export type SupportProvider = "patreon" | "custom" | "none";

export function supportProvider(): SupportProvider {
  const value = process.env.SUPPORT_PROVIDER?.trim().toLowerCase();
  if (value === "patreon") return "patreon";
  if (value === "custom") return "custom";
  if (value === "none") return "none";
  if (process.env.PATREON_URL?.trim()) return "patreon";
  if (process.env.DONATION_URL?.trim()) return "custom";
  return "none";
}

export function donationUrl(): string | null {
  if (!isDonationsEnabled()) return null;
  const provider = supportProvider();
  if (provider === "patreon") {
    return process.env.PATREON_URL?.trim() || null;
  }
  if (provider === "custom") {
    return process.env.DONATION_URL?.trim() || null;
  }
  return null;
}

export function donationLabel(): string {
  if (supportProvider() === "patreon") return "Support on Patreon";
  return process.env.DONATION_LABEL?.trim() || "Support Spellstutter";
}

/**
 * Premium gating only activates when Patreon OAuth is configured, because
 * otherwise there is no way to verify a supporter. Disabling monetization or
 * premium gating opens every feature.
 */
export function isPremiumGatingEnabled(): boolean {
  if (!isMonetizationEnabled()) return false;
  if (!envFlag("PREMIUM_GATING_ENABLED", true)) return false;
  return isPatreonOAuthEnabled();
}

/** Patreon OAuth is optional; the plain support link works without it. */
export function isPatreonOAuthEnabled(): boolean {
  if (!isMonetizationEnabled() || supportProvider() !== "patreon") {
    return false;
  }
  return Boolean(
    process.env.PATREON_CLIENT_ID?.trim() &&
      process.env.PATREON_CLIENT_SECRET?.trim() &&
      process.env.PATREON_CAMPAIGN_ID?.trim(),
  );
}

export function patreonMinCents(): number {
  const value = Number.parseInt(process.env.PATREON_MIN_CENTS ?? "0", 10);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
