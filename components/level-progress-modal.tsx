/** Tipe data satu tier level. */
export type LevelTier = {
  name: string;
  minLevel: number;
  maxLevel: number;
  color: string;
  icon: string;
  rangeLabel: string;
};

/** Daftar semua tier level. */
export const LEVEL_TIERS: LevelTier[] = [
  { name: "Newbie",    minLevel: 1,   maxLevel: 9,   color: "#9CA3AF", icon: "star-outline",   rangeLabel: "Level 1 – 9" },
  { name: "Bronze",   minLevel: 10,  maxLevel: 24,  color: "#CD7F32", icon: "star-half-full", rangeLabel: "Level 10 – 24" },
  { name: "Silver",   minLevel: 25,  maxLevel: 49,  color: "#94A3B8", icon: "star",            rangeLabel: "Level 25 – 49" },
  { name: "Gold",     minLevel: 50,  maxLevel: 74,  color: "#FBBF24", icon: "star-circle",     rangeLabel: "Level 50 – 74" },
  { name: "Platinum", minLevel: 75,  maxLevel: 99,  color: "#67E8F9", icon: "certificate",     rangeLabel: "Level 75 – 99" },
  { name: "Diamond",  minLevel: 100, maxLevel: 149, color: "#818CF8", icon: "diamond-stone",   rangeLabel: "Level 100 – 149" },
  { name: "Master",   minLevel: 150, maxLevel: 199, color: "#F472B6", icon: "crown",           rangeLabel: "Level 150 – 199" },
  { name: "Legend",   minLevel: 200, maxLevel: 999, color: "#FB923C", icon: "trophy",          rangeLabel: "Level 200+" },
];

/** Ambil tier untuk level tertentu. */
export function getTierForLevel(level: number): { currentTier: LevelTier; nextTier: LevelTier | null } {
  const idx = LEVEL_TIERS.findIndex((t) => level >= t.minLevel && level <= t.maxLevel);
  const currentTier = LEVEL_TIERS[idx] ?? LEVEL_TIERS[LEVEL_TIERS.length - 1];
  const nextTier = idx >= 0 && idx < LEVEL_TIERS.length - 1 ? LEVEL_TIERS[idx + 1] : null;
  return { currentTier, nextTier };
}
