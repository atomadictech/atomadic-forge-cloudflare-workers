/** Tier a1 — pure function for trust-gating LLM response text. */

import { TrustGateResult } from "../a0_qk_constants/types.ts";

export function trustGateResponse(
  response: string,
  intent?: string,
  strict?: boolean,
): TrustGateResult {
  const findings: string[] = [];
  const riskSignals: string[] = [];
  let score = 100;

  if (/I have (run|executed|verified|tested|confirmed)/.test(response) && !/```/.test(response)) {
    riskSignals.push("Claims execution/verification without showing output.");
    score -= 15;
  }
  if (/all tests pass/i.test(response) && !/```/.test(response)) {
    riskSignals.push("Claims all tests pass without showing test output.");
    score -= 20;
  }
  if (/✓ (all|tests|checks)/i.test(response)) {
    riskSignals.push("Check-mark assertions without evidence may be fabricated.");
    score -= 10;
  }
  if (/LGTM|looks good to me|approved|ship it/i.test(response)) {
    riskSignals.push("Self-approval language detected.");
    score -= 10;
  }

  const fileRefs = response.match(/`[a-zA-Z0-9_/.-]+\.(py|ts|js|json|yaml|toml)`/g) ?? [];
  if (fileRefs.length > 5) {
    findings.push(`References ${fileRefs.length} specific files — verify they exist.`);
  }

  if (intent) {
    const intentWords = intent.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const responseWords = new Set(response.toLowerCase().split(/\s+/));
    const overlap = intentWords.filter(w => responseWords.has(w)).length;
    const alignment = intentWords.length > 0 ? overlap / intentWords.length : 1;
    if (alignment < 0.3) {
      riskSignals.push("Response may not address the stated intent.");
      score -= 15;
    }
  }

  if (score >= 80) findings.push("No significant trust signals detected.");
  else if (score >= 60) findings.push("Minor trust signals — review before applying.");
  else findings.push("Multiple risk signals — manual review strongly recommended.");

  const baseVerdict: "PASS" | "REFINE" | "QUARANTINE" =
    score >= 80 ? "PASS" : score >= 50 ? "REFINE" : "QUARANTINE";

  return {
    schema_version: "atomadic-forge.trust_gate/v1",
    verdict: strict && score < 100 ? "REFINE" : baseVerdict,
    score: Math.max(0, score),
    findings,
    risk_signals: riskSignals,
  };
}
