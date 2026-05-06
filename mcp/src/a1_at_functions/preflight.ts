/** Tier a1 — pure function for pre-flight change validation. */

import { classifyFile } from "./repo_parser.ts";

export interface PreflightResult {
  schema_version: string;
  verdict: "GO" | "WARN" | "HALT";
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}

export function preflightChange(
  intent: string,
  proposedFiles: string[],
  scopeThreshold = 8,
): PreflightResult {
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

  checks.push({
    name: "scope",
    passed: proposedFiles.length <= scopeThreshold,
    detail: `${proposedFiles.length} files proposed (threshold: ${scopeThreshold})`,
  });

  checks.push({
    name: "intent_clarity",
    passed: intent.length >= 10,
    detail: intent.length >= 10
      ? "Intent is sufficiently specific."
      : "Intent is too vague — add more detail.",
  });

  const sourceFiles = proposedFiles.filter(f =>
    f.endsWith(".py") || f.endsWith(".ts") || f.endsWith(".js"),
  );
  const uncoveredSource = sourceFiles.filter(f => classifyFile(f) === null);
  checks.push({
    name: "tier_placement",
    passed: uncoveredSource.length === 0,
    detail: uncoveredSource.length === 0
      ? `All ${sourceFiles.length} source file(s) in valid tier directories.`
      : `${uncoveredSource.length} source file(s) outside tier structure: ${uncoveredSource.slice(0, 3).join(", ")}`,
  });

  const tiers = new Set(proposedFiles.map(classifyFile).filter(Boolean));
  checks.push({
    name: "tier_mixing",
    passed: tiers.size <= 3,
    detail: tiers.size <= 1
      ? "Single-tier change — low risk."
      : tiers.size <= 3
      ? `Cross-tier change touching ${tiers.size} tiers — verify import direction.`
      : `Wide cross-tier change touching ${tiers.size} tiers — consider splitting.`,
  });

  const failedCount = checks.filter(c => !c.passed).length;
  const verdict: "GO" | "WARN" | "HALT" =
    failedCount === 0 ? "GO" : failedCount <= 1 ? "WARN" : "HALT";

  return { schema_version: "atomadic-forge.preflight/v1", verdict, checks };
}
