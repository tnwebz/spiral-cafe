export const VALID_FLOOR_TABLES = [
  "A1", "A2",
  "B1", "B2", "B3", "B4", "B5", "B6",
  "C1", "C2", "C3",
  "F1", "F2", "F3", "F4",
] as const;

export const LEGACY_TABLE_NUMBER_MAP: Record<number, string> = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "B3",
  6: "B4",
  7: "B5",
  8: "B6",
  9: "C1",
  10: "C2",
  11: "C3",
  12: "F1",
  13: "F2",
  14: "F3",
  15: "F4",
};

export function resolveTableFromParam(param: string | null | undefined): string | null {
  if (!param) return null;
  const clean = String(param).trim().replace(/^table[\s\-_]*/i, "");

  // If pure number (1..15)
  if (/^\d+$/.test(clean)) {
    const num = parseInt(clean, 10);
    if (LEGACY_TABLE_NUMBER_MAP[num]) {
      return LEGACY_TABLE_NUMBER_MAP[num];
    }
    return null;
  }

  // If takeaway / parcel parameter
  const upper = clean.toUpperCase();
  if (upper === "TAKEAWAY" || upper === "TAKE-AWAY" || upper === "PARCEL") {
    return "TAKEAWAY";
  }

  // If uppercase code like A1, B2, etc.
  const found = (VALID_FLOOR_TABLES as readonly string[]).find((t) => t.toUpperCase() === upper);
  if (found) return found;

  return null;
}
