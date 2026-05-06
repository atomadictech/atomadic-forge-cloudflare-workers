/** Tier a1 — pure helpers for GitHub repo URL parsing and file tier classification. */

import { TIER_PATTERNS } from "../a0_qk_constants/tier_patterns.ts";

export interface ParsedRepo {
  owner: string;
  name: string;
}

/** Parse "owner/repo", "https://github.com/owner/repo", or "github.com/owner/repo". */
export function parseRepo(repo: string): ParsedRepo | null {
  const clean = repo
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], name: parts[1] };
}

/** Return the tier key (a0–a4) for a file path, or null if uncovered. */
export function classifyFile(path: string): string | null {
  for (const [tier, { dir }] of Object.entries(TIER_PATTERNS)) {
    if (dir.test(path)) return tier;
  }
  return null;
}

/** Return true if the filename matches the expected pattern for its tier. */
export function checkNamingConvention(path: string, tier: string): boolean {
  const filename = path.split("/").pop() ?? "";
  if (["__init__.py", "__main__.py", "index.ts", "index.js"].includes(filename)) return true;
  return TIER_PATTERNS[tier]?.filePattern.test(filename) ?? false;
}
