/** Only the identity constraints owned by GrowthOS are safe to expose/skip. */
export function prospectIdentityConstraint(error: unknown): string | null {
  let current = error as
    | { code?: string; constraint?: string; cause?: unknown }
    | undefined;
  for (let depth = 0; current && depth < 5; depth++) {
    if (
      current.code === "23505" &&
      ["idx_prospects_tenant_siret", "idx_prospects_tenant_siren"].includes(
        current.constraint || "",
      )
    )
      return current.constraint!;
    if (
      current.code === "23514" &&
      current.constraint === "prospects_identity_consistency"
    )
      return current.constraint;
    current = current.cause as typeof current;
  }
  return null;
}
export function isProspectIdentityDuplicate(error: unknown): boolean {
  return (
    prospectIdentityConstraint(error)?.startsWith("idx_prospects_") ?? false
  );
}
