/** Tier a1 — pure function for scoring git diffs against monadic architecture rules. */

import { PatchScore } from "../a0_qk_constants/types.ts";
import { TIER_ORDER } from "../a0_qk_constants/tier_patterns.ts";
import { classifyFile, checkNamingConvention } from "./repo_parser.ts";

export function scorePatch(diff: string): PatchScore {
  const lines = diff.split("\n");
  const addedFiles = lines.filter(l => l.startsWith("+++ b/")).map(l => l.slice(6));
  const addedLines = lines.filter(l => l.startsWith("+") && !l.startsWith("+++"));
  const signals: string[] = [];
  const warnings: string[] = [];

  // Tier placement
  const tieredFiles = addedFiles.filter(f => classifyFile(f));
  const tierScore = addedFiles.length === 0
    ? 100
    : Math.round((tieredFiles.length / addedFiles.length) * 100);
  if (addedFiles.length > 0 && tieredFiles.length < addedFiles.length) {
    warnings.push(`${addedFiles.length - tieredFiles.length} file(s) outside the tier structure.`);
  }

  // Import direction — detect upward imports
  let importViolations = 0;
  for (const line of addedLines) {
    if (!line.startsWith("+from ") && !line.startsWith("+import ") &&
        !line.startsWith('+import ') && !line.match(/^[+].*from ["']/)) continue;
    const importLine = line.slice(1);
    for (let i = 0; i < TIER_ORDER.length; i++) {
      for (let j = i + 1; j < TIER_ORDER.length; j++) {
        if (importLine.includes(TIER_ORDER[j]) && importLine.includes(TIER_ORDER[i])) {
          importViolations++;
          warnings.push(`Possible upward import: ${importLine.trim()}`);
        }
      }
    }
  }
  const importScore = Math.max(0, 100 - importViolations * 25);

  // Naming conventions
  let namingViolations = 0;
  for (const f of tieredFiles) {
    const tier = classifyFile(f);
    if (tier && !checkNamingConvention(f, tier)) namingViolations++;
  }
  const namingScore = tieredFiles.length === 0
    ? 100
    : Math.max(0, Math.round(
        ((tieredFiles.length - namingViolations) / tieredFiles.length) * 100,
      ));

  // Docstrings
  const newPyFiles = addedFiles.filter(f => f.endsWith(".py") || f.endsWith(".ts") || f.endsWith(".js"));
  let docstringCount = 0;
  for (const _f of newPyFiles) {
    const hasDoc = addedLines.some(l => l.includes('"""') || l.includes("'''") || l.includes("/** ") || l.includes("// Tier"));
    if (hasDoc) docstringCount++;
  }
  const docstringScore = newPyFiles.length === 0
    ? 100
    : Math.round((docstringCount / newPyFiles.length) * 100);
  if (newPyFiles.length > 0 && docstringCount < newPyFiles.length) {
    warnings.push(`${newPyFiles.length - docstringCount} new file(s) may be missing tier docstrings.`);
  }

  // Test coverage signal
  const touchesTests = addedFiles.some(f => /test_|_test\.|\.test\.|\.spec\./.test(f));
  const touchesSource = addedFiles.some(f =>
    (f.endsWith(".py") || f.endsWith(".ts") || f.endsWith(".js")) &&
    !/test_|_test\.|\.test\.|\.spec\./.test(f),
  );
  const testScore = touchesSource && !touchesTests ? 50 : 100;
  if (touchesSource && !touchesTests) {
    warnings.push("Patch modifies source files but includes no test changes.");
  }

  if (tieredFiles.length > 0) signals.push(`${tieredFiles.length} file(s) correctly placed in tier structure. ✓`);
  if (importViolations === 0 && addedLines.some(l => /import/.test(l))) signals.push("Import direction appears correct. ✓");
  if (touchesTests) signals.push("Patch includes test changes. ✓");

  const score = Math.round(
    tierScore * 0.30 +
    importScore * 0.30 +
    namingScore * 0.15 +
    docstringScore * 0.10 +
    testScore * 0.15,
  );

  return {
    schema_version: "atomadic-forge.patch_score/v1",
    score,
    verdict: score >= 80 ? "PASS" : score >= 60 ? "WARN" : "FAIL",
    dimensions: {
      tier_placement: { score: tierScore, detail: `${tieredFiles.length}/${addedFiles.length} changed files in tier dirs` },
      import_direction: { score: importScore, detail: `${importViolations} potential upward import(s)` },
      naming: { score: namingScore, detail: `${namingViolations} naming violation(s)` },
      docstrings: { score: docstringScore, detail: `${docstringCount}/${newPyFiles.length} new files have tier docstrings` },
      test_coverage: { score: testScore, detail: touchesTests ? "Patch includes test changes" : "No test changes in patch" },
    },
    signals,
    warnings,
  };
}
