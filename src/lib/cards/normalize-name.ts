export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Names a card can be referred to by. MTGO uses only the front face of modal
 * double-faced and adventure cards ("Delver of Secrets"), and the
 * slash-joined form for split cards ("Fire/Ice"), while Scryfall stores
 * "Delver of Secrets // Insectile Aberration" and "Fire // Ice".
 */
export function nameAliases(name: string): string[] {
  const aliases = new Set<string>([normalizeName(name)]);
  if (name.includes(" // ")) {
    const [front, back] = name.split(" // ");
    aliases.add(normalizeName(front));
    if (back) aliases.add(normalizeName(`${front}/${back}`));
  }
  return [...aliases];
}
