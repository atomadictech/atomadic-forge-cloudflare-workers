/** Tier a0 — shared types and interfaces for the Forge MCP Worker. */

export interface Env {
  GITHUB_TOKEN?: string;
  FORGE_VERSION?: string;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface McpRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: { [k: string]: JsonValue };
}

export interface McpResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: JsonValue;
  error?: { code: number; message: string; data?: JsonValue };
}

export interface ReconReport {
  schema_version: string;
  repo: string;
  total_files: number;
  python_files: number;
  tier_map: Record<string, number>;
  tier_coverage: number;
  uncovered_files: string[];
  naming_violations: string[];
  has_tests: boolean;
  test_file_count: number;
  top_level_py: string[];
}

export interface CertifyResult {
  schema_version: string;
  repo: string;
  score: number;
  verdict: "PASS" | "FAIL";
  checks: {
    tier_structure: { score: number; detail: string };
    naming_conventions: { score: number; detail: string };
    test_coverage: { score: number; detail: string };
    import_direction: { score: number; detail: string };
    tier_balance: { score: number; detail: string };
  };
  recommendations: string[];
}

export interface PatchScore {
  schema_version: string;
  score: number;
  verdict: "PASS" | "WARN" | "FAIL";
  dimensions: {
    tier_placement: { score: number; detail: string };
    import_direction: { score: number; detail: string };
    naming: { score: number; detail: string };
    docstrings: { score: number; detail: string };
    test_coverage: { score: number; detail: string };
  };
  signals: string[];
  warnings: string[];
}

export interface TrustGateResult {
  schema_version: string;
  verdict: "PASS" | "REFINE" | "QUARANTINE";
  score: number;
  findings: string[];
  risk_signals: string[];
}
