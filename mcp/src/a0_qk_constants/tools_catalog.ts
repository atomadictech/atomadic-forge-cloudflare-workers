/** Tier a0 — MCP tools catalogue (static schema definitions). v0.47.0 surface.
 *
 *  v0.46.0 redesign: 66 individual tools collapsed into 7 action-dispatch tools.
 *  v0.47.0: `create` exposed as 8th MCP tool (was CLI-only).
 *
 *  Each surviving tool uses ``action=`` (or ``op=`` for nexus) as its
 *  dispatch key. All 66 legacy tool names continue to work via
 *  LEGACY_ENDPOINT_MAP — the dispatcher rewrites the call before routing.
 */

/** Total tool count in the v0.48.0 surface. */
export const DELUXE_TOOLS_TOTAL = 10;

/** Legacy endpoint -> new tool name + default action. Mirrors
 *  src/atomadic_forge/a3_og_features/surface_export.py LEGACY_ENDPOINT_MAP.
 *  Worker reads this when a legacy name lands on tools/call so old clients
 *  keep working without migration. */
export const LEGACY_ENDPOINT_MAP: Record<string, { tool: string; action?: string; op?: string }> = {
  // explore tool
  recon:                 { tool: "explore", action: "recon" },
  explain_repo:          { tool: "explore", action: "explain" },
  call_graph:            { tool: "explore", action: "call_graph" },
  smell_scan:            { tool: "explore", action: "smell_scan" },
  lineage:               { tool: "explore", action: "lineage" },
  audit_list:            { tool: "explore", action: "lineage" },
  why_did_this_change:   { tool: "explore", action: "lineage" },
  what_failed_last_time: { tool: "explore", action: "lineage" },
  harvest:               { tool: "explore", action: "harvest" },
  synergy_scan:          { tool: "explore", action: "synergy" },
  synergy:               { tool: "explore", action: "synergy" },
  emergent:              { tool: "explore", action: "scan" },
  emergent_scan:         { tool: "explore", action: "scan" },
  emergent_swarm:        { tool: "explore", action: "swarm" },
  recon_swarm:           { tool: "explore", action: "swarm" },
  discover:              { tool: "explore", action: "scan" },
  code_intel:            { tool: "explore", action: "call_graph" },
  // audit tool
  certify:               { tool: "audit", action: "certify" },
  wire:                  { tool: "audit", action: "wire" },
  enforce:               { tool: "audit", action: "enforce" },
  sidecar_validate:      { tool: "audit", action: "validate" },
  guard_install:         { tool: "audit", action: "guard" },
  verify:                { tool: "audit", action: "composite" },
  worktree_status:       { tool: "audit", action: "health" },
  exported_api_check:    { tool: "audit", action: "composite" },
  trust_gate_response:   { tool: "audit", action: "gate" },
  doctor:                { tool: "audit", action: "health" },
  preflight:             { tool: "audit", action: "check" },
  preflight_change:      { tool: "audit", action: "check" },
  score_patch:           { tool: "audit", action: "score" },
  select_tests:          { tool: "audit", action: "tests" },
  cna_check:             { tool: "audit", action: "cna" },
  rollback_plan:         { tool: "audit", action: "rollback" },
  manifest_diff:         { tool: "audit", action: "diff" },
  change_review:         { tool: "audit", action: "diff" },
  maintain:              { tool: "audit", action: "validate" },
  // plan tool (v0.48.0: 9 actions; transmute/loop split out)
  plan_apply:            { tool: "plan", action: "apply" },
  auto_plan:             { tool: "plan", action: "generate" },
  adapt_plan:            { tool: "plan", action: "generate" },
  auto_step:             { tool: "plan", action: "apply" },
  auto_apply:            { tool: "plan", action: "apply" },
  forge_locate:          { tool: "plan", action: "locate" },
  commit_compose:        { tool: "plan", action: "commit" },
  forge_util:            { tool: "plan", action: "locate" },
  context_pack:          { tool: "plan", action: "context" },
  workflow:              { tool: "plan", action: "compose" },
  compose_tools:         { tool: "plan", action: "compose" },
  load_policy:           { tool: "plan", action: "policy" },
  recipes:               { tool: "plan", action: "recipes" },
  list_recipes:          { tool: "plan", action: "recipes" },
  get_recipe:            { tool: "plan", action: "recipes" },
  tool_factory:          { tool: "plan", action: "scaffold" },
  // transmute tool (v0.48.0: flagship pipeline restored standalone)
  transmute:             { tool: "transmute", action: "auto" },
  auto:                  { tool: "transmute", action: "auto" },
  cherry:                { tool: "transmute", action: "cherry" },
  finalize:              { tool: "transmute", action: "finalize" },
  // loop tool (v0.48.0: LLM iteration restored standalone)
  loop:                  { tool: "loop", action: "iterate" },
  iterate:               { tool: "loop", action: "iterate" },
  iterate_start:         { tool: "loop", action: "iterate" },
  iterate_continue:      { tool: "loop", action: "resume" },
  evolve:                { tool: "loop", action: "evolve" },
  evolve_start:          { tool: "loop", action: "evolve" },
  // hive tool
  hive_agent:            { tool: "hive", action: "register" },
  hive_consensus:        { tool: "hive", action: "propose" },
  session:               { tool: "hive", action: "handoff_create" },
  handoff:               { tool: "hive", action: "handoff_create" },
  enhancement:           { tool: "hive", action: "enhance_propose" },
};

/** v0.47.0 — 8 action-dispatch tools mirroring the local Python TOOLS dict. */
export const TOOLS = [
  // ── welcome ─────────────────────────────────────────────────────────
  {
    name: "welcome",
    description:
      "RECOMMENDED FIRST CALL: full onboarding scan in one response — score, " +
      "violations, narrative, top 3 strengths, top 3 priorities, single best " +
      "next call, agent_guidance briefing, capability_showcase tour, and " +
      "safety_net guarantees. Optional since_receipt for diff-style returns.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: ["string", "null"], description: "Package name (auto-detected if omitted)" },
        since_receipt: { type: ["string", "null"], description: "Path to prior receipt for since-last-scan diff" },
        skip_certify: { type: "boolean", description: "Skip pytest run inside certify (default false)" },
      },
    },
    recommended_first_call: true,
  },

  // ── explore ─────────────────────────────────────────────────────────
  {
    name: "explore",
    description:
      "Codebase analysis & discovery. action='recon' walks tier map; " +
      "'explain' returns plain-English orientation; 'call_graph' AST walk " +
      "for a symbol; 'smell_scan' CC/LOC/dup detectors; 'lineage' queries " +
      "the audit log; 'harvest' cross-repo graft candidates; 'synergy' " +
      "feature-pair detection; 'scan'/'swarm' emergent composition discovery.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["recon", "explain", "call_graph", "smell_scan", "lineage",
                  "harvest", "synergy", "scan", "swarm"],
          default: "recon",
        },
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        repos: { type: "array", items: { type: "string" }, description: "Multi-repo list for swarm actions" },
        symbol: { type: "string", description: "Qualname for call_graph" },
        verbose: { type: "boolean" },
        top_n: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      },
    },
  },

  // ── audit ───────────────────────────────────────────────────────────
  {
    name: "audit",
    description:
      "Quality gates & change safety. action='certify' 0-100 score; " +
      "'wire' upward-import violations; 'enforce' apply mechanical fixes; " +
      "'validate'/'guard' sidecar+enforcement layers; 'composite'/'gate'/" +
      "'health' verify variants; 'check'/'score'/'tests'/'cna'/'rollback'/" +
      "'diff' preflight + change-review variants.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["certify", "wire", "enforce", "validate", "guard",
                  "composite", "gate", "health", "check", "score", "tests",
                  "cna", "rollback", "diff"],
          default: "certify",
        },
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        diff: { type: "string", description: "Unified diff for action=score" },
        response: { type: "string", description: "LLM response text for action=gate" },
        intent: { type: "string", description: "Edit intent for action=check" },
        proposed_files: { type: "array", items: { type: "string" } },
        scope_threshold: { type: "number", default: 8 },
        emit_receipt: { type: "boolean" },
        strict: { type: "boolean" },
      },
    },
  },

  // ── plan ────────────────────────────────────────────────────────────
  {
    name: "plan",
    description:
      "Orient + plan + dev utilities (v0.48.0: 9 actions; transmute and loop " +
      "split out as standalone tools). action='context'/'compose'/'policy'/" +
      "'recipes' for first-call orientation + workflow recipes; 'generate'/" +
      "'apply'/'locate'/'commit' for refactor planning + dev utilities; " +
      "'scaffold' for tool factory.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["context", "compose", "policy", "recipes",
                  "generate", "apply", "locate", "commit", "scaffold"],
          default: "context",
        },
        intent: { type: "string", description: "Goal/intent for compose or generate" },
        plan_id: { type: "string", description: "Saved plan ID for action=apply" },
        name: { type: "string", description: "Recipe/tool name for recipes/scaffold" },
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
      },
    },
  },

  // ── transmute (v0.48.0 — flagship spaghetti->certified pipeline) ─────
  {
    name: "transmute",
    description:
      "FLAGSHIP spaghetti->certified pipeline. action='auto' (default): " +
      "single-shot scout->cherry->assimilate->wire->certify->receipt. " +
      "action='cherry': produce a surgical cherry-pick manifest (cherry.json). " +
      "action='finalize': materialize an existing cherry.json into a package. " +
      "No LLM invoked — pure deterministic absorption. (Local-only — install " +
      "atomadic-forge locally to run.)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["auto", "cherry", "finalize"],
          default: "auto",
        },
        target: { type: "string", description: "Source repo path to absorb from" },
        output: { type: "string", description: "Output directory for the new package" },
        package: { type: "string", description: "Importable name (Python identifier)" },
        apply: { type: "boolean", default: false, description: "false=dry-run, true=write" },
        on_conflict: {
          type: "string",
          enum: ["rename", "first", "last", "fail"],
          default: "rename",
        },
        pick: { type: "array", items: { type: "string" } },
        pick_all: { type: "boolean", default: false },
        only_tier: { type: "string" },
      },
    },
  },

  // ── loop (v0.48.0 — LLM iteration loops restored standalone) ─────────
  {
    name: "loop",
    description:
      "LLM-driven iteration sessions. Forge has no embedded LLM — these " +
      "actions return prompts you feed to your own LLM, then the response " +
      "comes back here for the next round. action='iterate': scaffold and " +
      "emit first prompt; returns session_id. action='resume': feed LLM " +
      "response back to advance the session. action='evolve': start a " +
      "recursive multi-round session (D_max=23). action='evolve_step': " +
      "advance an active evolve round. (Local-only — install atomadic-forge " +
      "locally to run.)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["iterate", "resume", "evolve", "evolve_step"],
          default: "iterate",
        },
        intent: { type: "string" },
        output: { type: "string" },
        package: { type: "string" },
        seed_repos: { type: "array", items: { type: "string" } },
        target_score: { type: "number", default: 75.0 },
        max_iterations: { type: "integer", default: 5 },
        language: {
          type: "string",
          enum: ["python", "javascript", "typescript"],
          default: "python",
        },
        session_id: { type: "string" },
        response: { type: "string" },
        rounds: { type: "integer", default: 3, minimum: 1, maximum: 23 },
        evolve_session_id: { type: "string" },
      },
    },
  },

  // ── hive ────────────────────────────────────────────────────────────
  {
    name: "hive",
    description:
      "Multi-agent coordination. action='register'/'list'/'deactivate'/" +
      "'observe' for agent lifecycle; 'propose'/'vote'/'needs_vote'/'result'/" +
      "'recap' for consensus; 'handoff_create'/'handoff_list'/" +
      "'enhance_propose'/'enhance_list' for session state.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["register", "list", "deactivate", "observe",
                  "propose", "vote", "needs_vote", "result", "recap",
                  "handoff_create", "handoff_list",
                  "enhance_propose", "enhance_list"],
          default: "list",
        },
        agent_name: { type: "string" },
        proposal_id: { type: "string" },
        vote: { type: "string", enum: ["yes", "no", "abstain"] },
      },
    },
  },

  // ── wisdom ──────────────────────────────────────────────────────────
  {
    name: "wisdom",
    description:
      "Institutional memory DB. action='record' append a lesson; " +
      "'query' relevance-rank by scope/tags/text; 'list' paginated dump; " +
      "'recall' top-N repo-scoped entries (cheapest read); 'promote' " +
      "cluster corroborated wisdom into draft recipes.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["record", "query", "list", "recall", "promote"],
          default: "recall",
        },
        insight: { type: "string" },
        scope: { type: "string", enum: ["repo", "forge", "general"], default: "repo" },
        tags: { type: "array", items: { type: "string" } },
        evidence: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        text: { type: "string", description: "Free-text query" },
        top_n: { type: "integer", minimum: 1, maximum: 50, default: 5 },
        limit: { type: "integer", default: 20 },
        include_bodies: { type: "boolean", default: false },
        include_superseded: { type: "boolean", default: false },
      },
    },
  },

  // ── nexus ───────────────────────────────────────────────────────────
  {
    name: "nexus",
    description:
      "AAAA-Nexus auth primitives (uses op= NOT action=). " +
      "op='identity_verify' | 'federation_mint' | 'authorize_action' | " +
      "'sys_trust_gate' | 'contract_verify' | 'lineage_record' | " +
      "'ratchet_register'. Requires ATOMADIC_MASTER_KEY or " +
      "ATOMADIC_SUBSCRIPTION_KEY env. The 'authorize_action' op uses " +
      "a separate 'action' field (the action being authorized) — " +
      "distinct from this tool's op= dispatch key.",
    inputSchema: {
      type: "object",
      properties: {
        op: {
          type: "string",
          enum: ["identity_verify", "federation_mint", "authorize_action",
                  "sys_trust_gate", "contract_verify", "lineage_record",
                  "ratchet_register"],
        },
        identity: { type: "string" },
        did: { type: "string" },
        scope: { type: "string" },
        ttl_secs: { type: "integer" },
        action: { type: "string", description: "authorize_action: the Nexus action being authorized" },
        subject: { type: "string" },
        resource: { type: "string" },
        claim: { type: "string" },
        manifest_hash: { type: "string" },
        intent: { type: "string" },
        payload: { type: "object" },
        ratchet_id: { type: "string" },
        stamp: { type: "string" },
      },
      required: ["op"],
    },
  },

  // ── create ──────────────────────────────────────────────────────────
  {
    name: "create",
    description:
      "Intent + seed repos -> shippable pip-installable package. " +
      "Runs the full Phase 1 pipeline: emergent_swarm cross-repo composition " +
      "discovery -> materialize top-N candidates into tier-organized package " +
      "-> optional certify. Returns the create receipt with scan_summary, " +
      "materialize report, and scan_report_path. (Local-only — requires " +
      "filesystem access; install atomadic-forge locally to run.)",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "One-line description of the package" },
        seed_repos: { type: "array", items: { type: "string" }, description: "Paths to repos to scan" },
        out_dir: { type: "string", description: "Where to write the new package" },
        package: { type: "string", description: "Importable name (Python identifier)" },
        top_n: { type: "integer", default: 5, minimum: 1, maximum: 50 },
        run_certify: { type: "boolean", default: true },
        swarm_max_depth: { type: "integer", default: 3, minimum: 1, maximum: 23 },
        require_pure: { type: "boolean", default: false },
        domain_jump_required: { type: "boolean", default: true },
        cross_repo_bonus: { type: "number", default: 15.0 },
        corroborate_with_call_graph: { type: "boolean", default: true },
      },
      required: ["intent", "seed_repos", "out_dir", "package"],
    },
  },
] as const;
