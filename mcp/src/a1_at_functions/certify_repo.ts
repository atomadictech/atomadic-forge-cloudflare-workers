/** Tier a1 — pure functions for repo file analysis and certify scoring. */

import { ReconReport, CertifyResult } from "../a0_qk_constants/types.ts";
import { classifyFile, checkNamingConvention } from "./repo_parser.ts";

/** Build a ReconReport from a flat list of file paths. */
export function analyzeFiles(owner: string, repoName: string, files: string[]): ReconReport {
  const pyFiles = files.filter(f => f.endsWith(".py") && !f.startsWith("."));
  const tierMap: Record<string, number> = { a0: 0, a1: 0, a2: 0, a3: 0, a4: 0 };
  const covered: string[] = [];
  const uncovered: string[] = [];
  const namingViolations: string[] = [];

  for (const f of pyFiles) {
    const tier = classifyFile(f);
    if (tier) {
      tierMap[tier]++;
      covered.push(f);
      if (!checkNamingConvention(f, tier)) namingViolations.push(f);
    } else {
      uncovered.push(f);
    }
  }

  const testFiles = pyFiles.filter(f => /test_|_test\.py/.test(f));
  const topLevelPy = pyFiles.filter(f => !f.includes("/")).slice(0, 10);

  return {
    schema_version: "atomadic-forge.recon/v1",
    repo: `${owner}/${repoName}`,
    total_files: files.length,
    python_files: pyFiles.length,
    tier_map: tierMap,
    tier_coverage: pyFiles.length > 0
      ? Math.round((covered.length / pyFiles.length) * 100)
      : 0,
    uncovered_files: uncovered.slice(0, 20),
    naming_violations: namingViolations.slice(0, 20),
    has_tests: testFiles.length > 0,
    test_file_count: testFiles.length,
    top_level_py: topLevelPy,
  };
}

/** Derive a CertifyResult from a ReconReport. Pure: no I/O. */
export function certifyRepo(recon: ReconReport): CertifyResult {
  const presentTiers = Object.values(recon.tier_map).filter(n => n > 0).length;
  const tierScore = Math.min(100, Math.round((presentTiers / 5) * 100));

  const namingScore = recon.python_files > 0
    ? Math.max(0, Math.round(
        ((recon.python_files - recon.naming_violations.length) / recon.python_files) * 100,
      ))
    : 100;

  const rawTestScore = recon.has_tests
    ? Math.round((recon.test_file_count / Math.max(1, recon.python_files - recon.test_file_count)) * 100)
    : 0;
  const testScore = Math.min(100, rawTestScore);

  const totalTiered = Object.values(recon.tier_map).reduce((a, b) => a + b, 0);
  const maxShare = totalTiered > 0
    ? Math.max(...Object.values(recon.tier_map)) / totalTiered
    : 0;
  const balanceScore = maxShare > 0.8
    ? Math.round((1 - maxShare) * 100 + 20)
    : 100;

  const score = Math.round(
    tierScore * 0.30 +
    namingScore * 0.20 +
    testScore * 0.15 +
    recon.tier_coverage * 0.25 +
    balanceScore * 0.10,
  );

  const recommendations: string[] = [];
  if (tierScore < 60) recommendations.push("Create missing tier directories (a0–a4).");
  if (namingScore < 80) recommendations.push("Rename files to match tier naming conventions.");
  if (testScore < 40) recommendations.push("Add test files under a tests/ directory.");
  if (recon.tier_coverage < 70) recommendations.push("Move uncovered Python files into the correct tier directory.");
  if (balanceScore < 70) recommendations.push("Redistribute files — one tier dominates.");

  return {
    schema_version: "atomadic-forge.certify/v1",
    repo: recon.repo,
    score,
    verdict: score >= 70 ? "PASS" : "FAIL",
    checks: {
      tier_structure: {
        score: tierScore,
        detail: `${presentTiers}/5 tiers present`,
      },
      naming_conventions: {
        score: namingScore,
        detail: `${recon.naming_violations.length} naming violations`,
      },
      test_coverage: {
        score: testScore,
        detail: recon.has_tests ? `${recon.test_file_count} test file(s)` : "No test files",
      },
      import_direction: {
        score: recon.tier_coverage,
        detail: `${recon.tier_coverage}% of Python files in valid tier dir`,
      },
      tier_balance: {
        score: balanceScore,
        detail: `Tier distribution: ${Object.entries(recon.tier_map).map(([t, n]) => `${t}:${n}`).join(", ")}`,
      },
    },
    recommendations,
  };
}
