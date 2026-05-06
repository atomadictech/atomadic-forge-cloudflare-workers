/** Tier a0 — MCP tools catalogue (static schema definitions). v0.10.0 surface. */

/** Total tools in the v0.10.0 consolidated surface. */
export const DELUXE_TOOLS_TOTAL = 40;

export const TOOLS = [
  // ── Core analysis (remote / GitHub API) ──────────────────────────────

  {
    name: "recon",
    description: "Walk a repo and classify every public symbol into the 5 monadic tiers. Returns tier map, file counts, symbol inventory, and architecture health signals.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        verbose: { type: "boolean", description: "Include full file listing (default false)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "certify",
    description: "0–100 score across documentation, tests, tier layout, and import discipline. Returns verdict (PASS/FAIL) and per-axis breakdown.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        emit_receipt: { type: "boolean", description: "Include a signed forge receipt in the response" },
      },
      required: ["repo"],
    },
  },
  {
    name: "enforce",
    description: "Enforce 5-tier monadic architecture — find violations and optionally suggest fixes.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        apply: { type: "boolean", description: "Return suggested fix instructions" },
      },
      required: ["repo"],
    },
  },
  {
    name: "wire",
    description: "Find every upward-import violation between tiers in a repo.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        suggest_repairs: { type: "boolean", description: "Include suggested repair instructions" },
      },
      required: ["repo"],
    },
  },
  {
    name: "context_pack",
    description: "First-call context bundle for any agent connecting to a repo: tier map, architecture law, blockers, best next action, test commands, release gate, risky files, recent lineage.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        include_symbols: { type: "boolean", description: "Include file listing (default false)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "explain_repo",
    description: "Generate a comprehensive repo explanation including architecture, entry points, and recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        depth: { type: "string", enum: ["brief", "standard", "deep"], description: "Explanation depth (default: standard)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "select_tests",
    description: "Identify tests affected by a change.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        changed_files: { type: "array", items: { type: "string" }, description: "Source files that changed" },
      },
      required: ["repo", "changed_files"],
    },
  },
  {
    name: "compose_tools",
    description: "Compose multiple Forge tools in sequence (recon → certify → enforce pipeline).",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        tools: { type: "array", items: { type: "string" }, description: "Tool names to compose in order" },
      },
      required: ["repo", "tools"],
    },
  },
  {
    name: "load_policy",
    description: "Load the enforcement policy for a repo.",
    inputSchema: {
      type: "object",
      properties: { repo: { type: "string", description: "GitHub repo URL or owner/repo" } },
      required: ["repo"],
    },
  },

  // ── Pure analysis (no repo required) ──────────────────────────────────

  {
    name: "score_patch",
    description: "0–100 architecture-quality risk score for a unified diff — per-dimension breakdown flags tier violations, scope creep, and missing tests.",
    inputSchema: {
      type: "object",
      properties: {
        diff: { type: "string", description: "git diff output to score" },
        context: { type: "string", description: "Optional: repo context or project description" },
      },
      required: ["diff"],
    },
  },
  {
    name: "preflight_change",
    description: "Validate proposed files don't break tier discipline BEFORE you write code — checks intent, tier assignment, and scope threshold.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "What the change is intended to do" },
        proposed_files: { type: "array", items: { type: "string" }, description: "Files that will be modified" },
        scope_threshold: { type: "number", description: "Max files before scope warning (default 8)" },
      },
      required: ["intent", "proposed_files"],
    },
  },
  {
    name: "trust_gate_response",
    description: "Validate agent output before applying — catches hallucinated paths, fabricated test results, and self-approval patterns.",
    inputSchema: {
      type: "object",
      properties: {
        response: { type: "string", description: "Agent response text to validate" },
        intent: { type: "string", description: "Original intent the response was meant to fulfill" },
        strict: { type: "boolean", description: "Fail on warnings as well as errors (default false)" },
      },
      required: ["response"],
    },
  },
  {
    name: "manifest_diff",
    description: "Schema-aware diff between two Forge manifests. Reports added/removed/moved symbols, tier deltas, score deltas. Inline-dict mode works remotely.",
    inputSchema: {
      type: "object",
      properties: {
        left: { type: "object" },
        left_path: { type: "string" },
        right: { type: "object" },
        right_path: { type: "string" },
      },
    },
  },

  // ── Merged verbs (v0.10.0 consolidation) ──────────────────────────────

  {
    name: "plan",
    description: "Generate a ranked refactor plan for a repo; pass a `plan` dict to filter cards against agent capabilities (adapt mode). Merges former auto_plan + adapt_plan.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo (required for fresh plan)" },
        goal: { type: "string", description: "Refactor goal (default: 'improve repo conformance')" },
        top_n: { type: "number", description: "Max plan cards to return (default 7)" },
        plan: { type: "object", description: "Existing agent_plan/v1 to adapt (triggers adapt mode)" },
        agent_capabilities: { type: "array", items: { type: "string" }, description: "Capability tokens for adapt mode (e.g. edit_files, run_commands, delegate)" },
      },
    },
  },
  {
    name: "plan_apply",
    description: "Execute a saved plan — pass card_id for a single card, omit for all applyable cards in sequence. File-system mutations require local CLI.",
    inputSchema: {
      type: "object",
      properties: {
        plan_id: { type: "string", description: "Plan ID from a saved plan" },
        card_id: { type: "string", description: "Single card to apply (omit for all cards)" },
        apply: { type: "boolean", description: "Dry-run by default (false); true executes the change" },
      },
    },
  },
  {
    name: "lineage",
    description: "Query the .atomadic-forge lineage log — all events (no args), blame a file (file=), or show recent failures for an area (area=). Mode is auto-detected from args.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        file: { type: "string", description: "File path to blame (triggers by_file mode)" },
        area: { type: "string", description: "Area/module to check failures for (triggers failed_for_area mode)" },
        mode: { type: "string", enum: ["all", "by_file", "failed_for_area"], description: "Explicit mode override" },
        limit: { type: "number", description: "Number of recent runs to inspect (default 5, max 10)" },
        branch: { type: "string", description: "Branch to check (default: default branch)" },
      },
    },
  },
  {
    name: "recipes",
    description: "Forge's named golden-path recipes — call with no `name` for the full catalogue, with `name` for the step-by-step body of that recipe.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Recipe name (omit to list all available recipes)" },
      },
    },
  },
  {
    name: "verify",
    description: "Verify the public API surface or repo conformance. Merges former exported_api_check. Pass check_exports=true to compare public API surface between two refs.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        check_exports: { type: "boolean", description: "Compare exported API surface (formerly exported_api_check)" },
        base: { type: "string", description: "Base ref (default: main)" },
        head: { type: "string", description: "Head ref (default: HEAD)" },
        source: { type: "string", description: "Source path for local verify" },
        path: { type: "string", description: "Path for local verify" },
      },
    },
  },

  // ── Operational / diagnostic ───────────────────────────────────────────

  {
    name: "doctor",
    description: "Environment diagnostic — reports Forge worker version + remote-vs-local capability split. Pass include_worktree=true for git orientation (formerly worktree_status).",
    inputSchema: {
      type: "object",
      properties: {
        include_worktree: { type: "boolean", description: "Include git worktree status (local-only; worker returns redirect)" },
        project_root: { type: "string" },
        max_files: { type: "integer" },
      },
    },
  },
  {
    name: "rollback_plan",
    description: "Structured undo plan: files to remove, caches to clean, docs to restore, tests to rerun. Requires local git access — worker returns a redirect to the local CLI.",
    inputSchema: {
      type: "object",
      properties: {
        changed_files: { type: "array", items: { type: "string" } },
        project_root: { type: "string" },
      },
      required: ["changed_files"],
    },
  },
  {
    name: "sidecar_validate",
    description: "Cross-check a .forge sidecar against its source AST (S0000–S0007 finding classes). Local-only — worker returns a redirect.",
    inputSchema: {
      type: "object",
      properties: {
        source_file: { type: "string", description: "Path to the source file." },
      },
      required: ["source_file"],
    },
  },

  // ── Discovery / composition ────────────────────────────────────────────

  {
    name: "emergent_scan",
    description: "Find latent a3 features by detecting input/output alignment of existing functions — surfaces compositions you can ship without writing new logic.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        top_n: { type: "integer", default: 25 },
      },
      required: ["repo"],
    },
  },
  {
    name: "emergent_swarm",
    description: "Surface compositions that only become visible across multiple repos — cross-domain emergent scan merged into a unified ranking.",
    inputSchema: {
      type: "object",
      properties: {
        repos: { type: "array", items: { type: "string" }, description: "List of GitHub repo URLs or owner/repo" },
        top_n: { type: "integer", default: 25 },
      },
      required: ["repos"],
    },
  },
  {
    name: "synergy_scan",
    description: "Find CLI verbs or features that share an artifact but lack an adapter — eight signals: json_artifact, in_memory_pipe, shared_schema, shared_vocabulary, phase_omission, feedback_loop, type_pipeline, data_flow_gap.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        package: { type: "string", default: "atomadic_forge" },
        top_n: { type: "integer", default: 25 },
      },
      required: ["repo"],
    },
  },
  {
    name: "recon_swarm",
    description: "Unified scout report across N repos for portfolio-scale composition — tier-distribution summary, certify scores, and cross-repo violation ranking in one call.",
    inputSchema: {
      type: "object",
      properties: {
        repos: { type: "array", items: { type: "string" }, description: "GitHub repo URLs or owner/repo" },
        verbose: { type: "boolean" },
      },
      required: ["repos"],
    },
  },
  {
    name: "smell_scan",
    description: "Detect code smells and anti-patterns across a repo's tier layout: God modules, implicit a2 composites, missing docstrings, oversized files.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        top_n: { type: "integer", default: 20 },
      },
      required: ["repo"],
    },
  },

  // ── Absorb pipeline (auto / cherry / finalize) ─────────────────────────

  {
    name: "auto",
    description: "Flagship single-shot transmuter: scout → cherry → assimilate → wire → certify in one call. Pass a GitHub repo; get back a tier-organized, certify-scored package.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Source GitHub repo URL or owner/repo" },
        output: { type: "string", description: "Output package path (local CLI only)" },
        package: { type: "string", description: "Output package name" },
        apply: { type: "boolean", description: "Materialize output (local CLI only)" },
      },
      required: ["repo"],
    },
  },
  {
    name: "cherry",
    description: "Cherry-pick manifest of symbols from a scouted repo — surgical pre-step before finalize, for precise control over what gets absorbed.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo to cherry-pick from" },
        filter: { type: "string", description: "Symbol filter expression" },
        top_n: { type: "integer", default: 50 },
      },
      required: ["repo"],
    },
  },
  {
    name: "harvest",
    description: "Find capabilities your target repo lacks but sibling repos already have — τ_trust-gated cross-repo capability gap detection.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        top_n: { type: "integer", default: 30 },
      },
      required: ["repo"],
    },
  },
  {
    name: "finalize",
    description: "Materialize a cherry-pick manifest into a tier-organized output package, then wire and certify. Requires local filesystem — worker returns a redirect.",
    inputSchema: {
      type: "object",
      properties: {
        manifest_path: { type: "string", description: "Path to cherry manifest JSON" },
        output: { type: "string", description: "Output package path" },
        package: { type: "string", description: "Output package name" },
      },
      required: ["manifest_path"],
    },
  },

  // ── Iterate / evolve (agent-driven LLM loop) ───────────────────────────

  {
    name: "iterate_start",
    description: "Open an architecture loop where the calling agent IS the LLM — Forge drives prompts toward certify >= target_score, you execute and report back. Requires local Python env.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "Goal for the iterate loop" },
        target_score: { type: "number", description: "Target certify score (default 75)" },
        project_root: { type: "string" },
      },
      required: ["intent"],
    },
  },
  {
    name: "iterate_continue",
    description: "Feed your last execution result into an open iterate session; get the next architecture prompt. Requires local Python env.",
    inputSchema: {
      type: "object",
      properties: {
        loop_id: { type: "string", description: "Loop ID from iterate_start" },
        last_result: { type: "object", description: "Result of the last action card applied" },
        project_root: { type: "string" },
      },
      required: ["loop_id"],
    },
  },
  {
    name: "evolve_start",
    description: "Recursive iterate — each round's output becomes the seed for the next. Open a recursive self-improvement session toward a target certify score. Requires local Python env.",
    inputSchema: {
      type: "object",
      properties: {
        intent: { type: "string", description: "High-level goal for the evolved package" },
        package: { type: "string", default: "evolved" },
        project_root: { type: "string" },
        target_score: { type: "number", default: 75 },
        rounds: { type: "number", default: 3 },
      },
      required: ["intent"],
    },
  },
  {
    name: "evolve_step",
    description: "Execute one round of an in-progress evolve cycle. Pass the evolution_id from evolve_start. Returns the round log and updated score.",
    inputSchema: {
      type: "object",
      properties: {
        evolution_id: { type: "string", description: "Evolution ID from evolve_start" },
        project_root: { type: "string" },
      },
      required: ["evolution_id"],
    },
  },

  // ── Code intelligence ──────────────────────────────────────────────────

  {
    name: "call_graph",
    description: "Build a function-level call graph for a repo. Returns caller→callee edges, cycle detection, and entry-point ranking. Requires local AST access — worker returns a redirect.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo (for remote file listing)" },
        project_root: { type: "string" },
        package: { type: "string" },
      },
    },
  },
  {
    name: "cna_check",
    description: "Compose-Not-Add gate — blocks duplicating a symbol Forge already owns at the correct tier. Prevents accidental reimplementation of existing capabilities.",
    inputSchema: {
      type: "object",
      properties: {
        project_root: { type: "string" },
        package: { type: "string" },
      },
    },
  },
  {
    name: "commit_compose",
    description: "Compose a conventional-commit message from staged changes, certify-score delta, and wire findings. Returns a draft commit message with co-authorship block.",
    inputSchema: {
      type: "object",
      properties: {
        diff: { type: "string", description: "git diff --staged output" },
        score_before: { type: "number" },
        score_after: { type: "number" },
        context: { type: "string" },
      },
      required: ["diff"],
    },
  },
  {
    name: "forge_locate",
    description: "Locate a symbol, file, or pattern in a repo's tier map. Returns exact tier, path, and related symbols. Combines recon + symbol search.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "GitHub repo URL or owner/repo" },
        query: { type: "string", description: "Symbol name, file glob, or keyword" },
      },
      required: ["query"],
    },
  },
  {
    name: "tool_factory",
    description: "Generate a new MCP tool stub conforming to the 5-tier monadic layout: a0 types, a1 pure logic, a2 handler, a4 registration. Requires local filesystem — worker returns a redirect.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tool name (snake_case)" },
        description: { type: "string", description: "Tool description" },
        project_root: { type: "string" },
      },
      required: ["name", "description"],
    },
  },
  {
    name: "guard_install",
    description: "Install a forge pre-commit hook and optional GitHub Action that blocks commits/PRs on wire violations or certify regressions. Requires local filesystem — worker returns a redirect.",
    inputSchema: {
      type: "object",
      properties: {
        project_root: { type: "string" },
        min_score: { type: "number", description: "Minimum certify score to allow (default 75)" },
        action: { type: "boolean", description: "Also install GitHub Action (default false)" },
      },
    },
  },
] as const;
