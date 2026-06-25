import type {
  Player,
} from "@/types/player";

const internalSkillOverridesByName =
  new Map<string, number>([
    ["김가은", 12],
    ["임지은", 12],
  ]);

function normalizeName(name: string) {
  return name.replace(/\s+/g, "");
}

export function getEffectiveHiddenSkill(
  playerOrName: Pick<
    Player,
    "name" | "hiddenSkill"
  > | string,
  fallbackHiddenSkill?: number
) {
  const name =
    typeof playerOrName === "string"
      ? playerOrName
      : playerOrName.name;
  const originalHiddenSkill =
    typeof playerOrName === "string"
      ? fallbackHiddenSkill
      : playerOrName.hiddenSkill;
  const overriddenSkill =
    internalSkillOverridesByName.get(
      normalizeName(name)
    );

  return (
    overriddenSkill ??
    originalHiddenSkill ??
    35
  );
}

export function applyInternalSkillOverride<
  T extends Pick<
    Player,
    "name" | "hiddenSkill"
  >,
>(player: T): T {
  const hiddenSkill =
    getEffectiveHiddenSkill(player);

  return hiddenSkill ===
    player.hiddenSkill
    ? player
    : {
        ...player,
        hiddenSkill,
      };
}
