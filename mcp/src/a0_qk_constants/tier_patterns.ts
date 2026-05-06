/** Tier a0 — Atomadic 5-tier naming patterns and constants. */

export const TIER_PATTERNS: Record<string, { dir: RegExp; filePattern: RegExp }> = {
  a0: { dir: /a0_qk_constants/, filePattern: /(_constants|_config|_types|_enums)\.(?:py|ts|js)$/ },
  a1: { dir: /a1_at_functions/, filePattern: /(_utils|_helpers|_validators|_parsers|_functions)\.(?:py|ts|js)$/ },
  a2: { dir: /a2_mo_composites/, filePattern: /(_client|_core|_store|_registry|_composites)\.(?:py|ts|js)$/ },
  a3: { dir: /a3_og_features/, filePattern: /(_feature|_service|_pipeline|_gate|_features)\.(?:py|ts|js)$/ },
  a4: { dir: /a4_sy_orchestration/, filePattern: /(_cmd|_cli|_runner|_main|_orchestration|index)\.(?:py|ts|js)$/ },
};

export const TIER_ORDER = ["a4", "a3", "a2", "a1", "a0"] as const;

export const PROTOCOL_VERSION = "2025-11-05";
export const SERVER_NAME = "atomadic-forge";
export const SERVER_VERSION = "0.16.2";

export const ERR_PARSE           = -32700;
export const ERR_METHOD_NOT_FOUND = -32601;
export const ERR_INVALID_PARAMS  = -32602;
export const ERR_INTERNAL        = -32603;
export const JSONRPC             = "2.0";
