const ARRAY_FIELDS = [
  "players",
  "courts",
  "fixedPartnerRequests",
  "fixedPartnerAssignments",
  "fixedPartnerRequestResolutions",
  "notifications",
  "matchHistory",
  "excludedMatchPairs",
] as const;

export function normalizePersistedMatchState(
  persistedState: unknown
) {
  if (
    !persistedState ||
    typeof persistedState !== "object" ||
    Array.isArray(persistedState)
  ) {
    return {};
  }

  const normalized = {
    ...(persistedState as Record<
      string,
      unknown
    >),
  };

  ARRAY_FIELDS.forEach((field) => {
    if (!Array.isArray(normalized[field])) {
      normalized[field] = [];
    }
  });

  normalized.recommendations = [];
  normalized.selectedRecommendation =
    null;
  normalized.womenDoublesPriority =
    normalized.womenDoublesPriority ===
    true;

  return normalized;
}
