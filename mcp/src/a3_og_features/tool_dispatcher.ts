/** Tier a3 — feature: routes tool calls to their implementations.
 *  v0.47.0 surface — 8 action-dispatch tools + legacy-name redirects.
 */

import { Env, JsonValue } from "../a0_qk_constants/types.ts";
import { RECIPES } from "../a0_qk_constants/recipes.ts";
import { LEGACY_ENDPOINT_MAP } from "../a0_qk_constants/tools_catalog.ts";
import { parseRepo } from "../a1_at_functions/repo_parser.ts";
import { analyzeFiles, certifyRepo } from "../a1_at_functions/certify_repo.ts";
import { scorePatch } from "../a1_at_functions/score_patch.ts";
import { trustGateResponse } from "../a1_at_functions/trust_gate.ts";
import { preflightChange } from "../a1_at_functions/preflight.ts";
import { GitHubClient } from "../a2_mo_composites/github_client.ts";

/** v0.47.0 — Action-dispatch routing tables.
 *  Maps each new tool's `action` (or `op` for nexus) to a legacy tool name
 *  that has an existing edge handler below. Allows the new 8-tool surface
 *  to reuse the 600+ lines of GitHub-API-backed logic without duplication.
 */
const ACTION_TO_LEGACY: Record<string, Record<string, string>> = {
  explore: {
    recon: "recon", explain: "explain_repo", call_graph: "call_graph",
    smell_scan: "smell_scan", lineage: "lineage", harvest: "harvest",
    synergy: "synergy_scan", scan: "emergent_scan", swarm: "emergent_swarm",
  },
  audit: {
    certify: "certify", wire: "wire", enforce: "enforce",
    validate: "sidecar_validate", guard: "guard_install",
    composite: "verify", gate: "trust_gate_response", health: "doctor",
    check: "preflight_change", score: "score_patch", tests: "select_tests",
    cna: "cna_check", rollback: "rollback_plan", diff: "manifest_diff",
  },
  plan: {
    context: "context_pack", compose: "compose_tools", policy: "load_policy",
    recipes: "recipes", generate: "plan", apply: "plan_apply",
    locate: "forge_locate", commit: "commit_compose",
    scaffold: "tool_factory",
  },
  transmute: {
    auto: "auto", cherry: "cherry", finalize: "finalize",
  },
  loop: {
    iterate: "iterate_start", resume: "iterate_continue",
    evolve: "evolve_start", evolve_step: "evolve_step",
  },
  hive: {
    register: "hive_agent", list: "hive_agent", deactivate: "hive_agent",
    observe: "hive_agent", propose: "hive_consensus", vote: "hive_consensus",
    needs_vote: "hive_consensus", result: "hive_consensus", recap: "hive_consensus",
    handoff_create: "handoff", handoff_list: "handoff",
    enhance_propose: "enhancement", enhance_list: "enhancement",
  },
  wisdom: {
    record: "wisdom_record", query: "wisdom_query", list: "wisdom_list",
    recall: "wisdom_recall", promote: "wisdom_promote",
  },
};

/** Resolve any legacy tool name OR action-dispatched name into the canonical
 *  legacy handler key + final args. Returns null if name is unknown. */
function resolveDispatch(
  name: string,
  args: Record<string, JsonValue>,
): { canonical: string; args: Record<string, JsonValue> } | null {
  // Path 1: it's already a legacy handler name → use as-is.
  // (Detected by checking if it's NOT one of the 8 new tools.)
  const NEW_TOOLS = new Set(["welcome", "explore", "audit", "plan", "transmute", "loop", "hive", "wisdom", "nexus", "create"]);
  if (!NEW_TOOLS.has(name)) {
    // Either a true legacy name (recon, certify, ...) or unknown.
    // If LEGACY_ENDPOINT_MAP has it, resolve transitively.
    const mapped = LEGACY_ENDPOINT_MAP[name];
    if (mapped) {
      // Legacy name → new tool + action; fold action into args, recurse.
      const newArgs = { ...args };
      if (mapped.action !== undefined) newArgs.action = mapped.action;
      if (mapped.op !== undefined) newArgs.op = mapped.op;
      return resolveDispatch(mapped.tool, newArgs);
    }
    // Direct legacy name with its own handler below — pass through.
    return { canonical: name, args };
  }
  // Path 2: it's a new action-dispatch tool. Map (tool, action) → legacy.
  if (name === "welcome" || name === "create" || name === "nexus") {
    // welcome/create/nexus have no action enum — handled directly below.
    return { canonical: name, args };
  }
  const action = String(args.action ?? "");
  const lookup = ACTION_TO_LEGACY[name];
  if (lookup && action && lookup[action]) {
    return { canonical: lookup[action], args };
  }
  // Fall through: invoke the new tool's case directly (will return defaults).
  return { canonical: name, args };
}

/** Local-only redirect response for tools that require filesystem/git/Python. */
function localOnlyRedirect(toolName: string): JsonValue {
  return {
    schema_version: `atomadic-forge.${toolName}/v1`,
    note: `${toolName} requires local filesystem / git access.`,
    instructions: "pip install atomadic-forge && forge mcp serve",
    docs: "https://forge.atomadic.tech",
  } as unknown as JsonValue;
}

export async function dispatchTool(
  name: string,
  args: Record<string, JsonValue>,
  env: Env,
): Promise<JsonValue> {
  // v0.47.0 — resolve legacy names + action-dispatched names to the
  // canonical handler key. Unknown names fall through to the default.
  const resolved = resolveDispatch(name, args);
  if (!resolved) {
    throw { code: -32601, message: `Unknown tool: ${name}` };
  }
  name = resolved.canonical;
  args = resolved.args;

  const gh = new GitHubClient(env);

  /** Resolve and validate a repo arg, returning parsed owner/name. */
  function repo() {
    const parsed = parseRepo(String(args.repo ?? ""));
    if (!parsed) throw new Error("Invalid repo: use 'owner/repo' or a GitHub URL");
    return parsed;
  }

  // ── v0.47.0 new tools that have no legacy handler ────────────────────

  if (name === "create") {
    return localOnlyRedirect("create");
  }
  if (name === "nexus") {
    return localOnlyRedirect("nexus");
  }
  // explore/audit/plan/transmute/loop/hive/wisdom with no resolved action:
  // the resolver mapped the action; if name is still one of these,
  // it means action was missing or unknown. Return localOnly with hint.
  if (["explore", "audit", "plan", "transmute", "loop", "hive", "wisdom"].includes(name)) {
    return {
      schema_version: `atomadic-forge.${name}/v1`,
      error: `${name} requires an 'action' parameter`,
      hint: `See tools/list for the action enum on '${name}'.`,
    } as unknown as JsonValue;
  }

  switch (name) {

    // ── Merged: recipes (replaces list_recipes + get_recipe) ────────────

    case "recipes": {
      const recipeName = args.name ? String(args.name) : null;
      if (!recipeName) {
        return {
          schema_version: "atomadic-forge.recipes/v1",
          count: Object.keys(RECIPES).length,
          recipes: Object.values(RECIPES).map(r => ({ name: r.name, description: r.description })),
        } as unknown as JsonValue;
      }
      const recipe = RECIPES[recipeName];
      if (!recipe) {
        return { schema_version: "atomadic-forge.recipes/v1", error: `Recipe '${recipeName}' not found.`, available: Object.keys(RECIPES) } as unknown as JsonValue;
      }
      return { schema_version: "atomadic-forge.recipes/v1", ...recipe } as unknown as JsonValue;
    }

    // ── Pure analysis ──────────────────────────────────────────────────

    case "score_patch": {
      const diff = String(args.diff ?? "");
      if (!diff) throw new Error("diff is required");
      return scorePatch(diff) as unknown as JsonValue;
    }

    case "trust_gate_response":
      return trustGateResponse(
        String(args.response ?? ""),
        args.intent ? String(args.intent) : undefined,
        Boolean(args.strict),
      ) as unknown as JsonValue;

    case "preflight_change": {
      const intent = String(args.intent ?? "");
      if (!intent) throw new Error("intent is required");
      const files = Array.isArray(args.proposed_files)
        ? (args.proposed_files as JsonValue[]).map(String)
        : [];
      if (!files.length) throw new Error("proposed_files is required");
      return preflightChange(intent, files, typeof args.scope_threshold === "number" ? args.scope_threshold : 8) as unknown as JsonValue;
    }

    case "commit_compose": {
      const diff = String(args.diff ?? "");
      if (!diff) throw new Error("diff is required");
      const scored = scorePatch(diff) as unknown as Record<string, unknown>;
      const scoreBefore = typeof args.score_before === "number" ? args.score_before : null;
      const scoreAfter = typeof args.score_after === "number" ? args.score_after : null;
      const delta = scoreBefore !== null && scoreAfter !== null ? scoreAfter - scoreBefore : null;
      return {
        schema_version: "atomadic-forge.commit_compose/v1",
        suggested_message: `refactor: ${String(args.context ?? "architectural improvement")}${delta !== null ? ` (certify ${delta >= 0 ? "+" : ""}${delta.toFixed(0)})` : ""}`,
        score_assessment: scored,
        co_authored_by: "Co-Authored-By: Atomadic Forge v0.10.0 <forge@atomadic.tech>",
      } as unknown as JsonValue;
    }

    // ── GitHub-backed ──────────────────────────────────────────────────

    case "recon": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const report = analyzeFiles(owner, repoName, files);
      if (args.verbose) return { ...report, all_files: files.slice(0, 200) } as unknown as JsonValue;
      return report as unknown as JsonValue;
    }

    case "certify": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      return certifyRepo(analyzeFiles(owner, repoName, files)) as unknown as JsonValue;
    }

    case "enforce": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      const violations = [
        ...recon.uncovered_files.map(f => `UNCOVERED: ${f}`),
        ...recon.naming_violations.map(f => `NAMING: ${f}`),
      ];
      return {
        schema_version: "atomadic-forge.enforce/v1",
        repo: recon.repo, violation_count: violations.length,
        violations: violations.slice(0, 30),
        verdict: violations.length === 0 ? "PASS" : "FAIL",
        note: args.apply ? "Use `recipes` for fix instructions." : "Pass apply=true for fix instructions.",
      } as unknown as JsonValue;
    }

    case "wire": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      return {
        schema_version: "atomadic-forge.wire/v1",
        repo: recon.repo,
        uncovered_python_files: recon.uncovered_files.filter(f => f.endsWith(".py")),
        tier_map: recon.tier_map,
        verdict: recon.uncovered_files.filter(f => f.endsWith(".py")).length === 0 ? "PASS" : "WARN",
        suggest_repairs: args.suggest_repairs ? "Use `recipes` with 'add-tier' for instructions." : undefined,
      } as unknown as JsonValue;
    }

    case "explain_repo": {
      const { owner, name: repoName } = repo();
      const [files, meta] = await Promise.all([
        gh.getRepoFiles(owner, repoName),
        gh.getRepoMeta(owner, repoName),
      ]);
      const recon = analyzeFiles(owner, repoName, files);
      const cert = certifyRepo(recon);
      return {
        schema_version: "atomadic-forge.explain/v1",
        repo: `${owner}/${repoName}`,
        description: meta.description ?? "(no description)",
        primary_language: meta.language ?? "unknown",
        stars: meta.stargazers_count ?? 0,
        open_issues: meta.open_issues_count ?? 0,
        architecture: { style: recon.tier_coverage > 60 ? "Atomadic 5-tier monadic" : "unstructured", tier_map: recon.tier_map, tier_coverage_pct: recon.tier_coverage },
        certify_score: cert.score, certify_verdict: cert.verdict,
        test_files: recon.test_file_count, total_python_files: recon.python_files,
        recommendations: cert.recommendations, entry_points: recon.top_level_py,
      } as unknown as JsonValue;
    }

    case "context_pack": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      const cert = certifyRepo(recon);
      return {
        schema_version: "atomadic-forge.context_pack/v1",
        repo: `${owner}/${repoName}`,
        tier_map: recon.tier_map, certify_score: cert.score, certify_verdict: cert.verdict,
        total_files: recon.total_files, python_files: recon.python_files,
        test_files: recon.test_file_count, tier_coverage_pct: recon.tier_coverage,
        top_violations: cert.recommendations,
        file_listing: args.include_symbols ? files.slice(0, 100) : undefined,
        quick_ref: { install: "pip install atomadic-forge", run: "forge mcp serve", docs: "https://forge.atomadic.tech" },
      } as unknown as JsonValue;
    }

    // ── Merged: plan (replaces auto_plan + adapt_plan) ─────────────────

    case "plan": {
      // Adapt mode: plan arg is a dict → tag cards with recommended_handling
      if (args.plan && typeof args.plan === "object" && !Array.isArray(args.plan)) {
        const planObj = args.plan as Record<string, JsonValue>;
        const caps = new Set(
          (Array.isArray(args.agent_capabilities) ? args.agent_capabilities : []) as string[]
        );
        const cards = (planObj.cards ?? planObj.top_actions ?? []) as Array<Record<string, JsonValue>>;
        const adapted = (Array.isArray(cards) ? cards : []).map((card) => {
          const kind = String(card.kind ?? "");
          const writes = Boolean(card.applyable);
          let recommended = "report_only";
          if (writes && caps.has("edit_files")) recommended = "apply";
          else if (writes && caps.has("delegate")) recommended = "delegate";
          else if (kind === "review" && caps.has("review")) recommended = "apply";
          else if (writes) recommended = "ask_human";
          return { ...card, recommended_handling: recommended };
        });
        return {
          schema_version: "atomadic-forge.agent_plan_adapted/v1",
          agent_capabilities: [...caps],
          cards: adapted as unknown as JsonValue,
        } as unknown as JsonValue;
      }
      // Fresh plan mode: generate from repo
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const cert = certifyRepo(analyzeFiles(owner, repoName, files));
      const topN = typeof args.top_n === "number" ? Math.min(args.top_n, 10) : 7;
      const cards = cert.recommendations.slice(0, topN).map((rec, i) => ({
        id: `card-${i + 1}`, title: rec, effort: "medium", impact: "high",
        applyable: false, note: "Apply locally with `pip install atomadic-forge` and `forge plan`.",
      }));
      return {
        schema_version: "atomadic-forge.plan/v1", repo: `${owner}/${repoName}`,
        goal: String(args.goal ?? "improve repo conformance"),
        certify_score: cert.score, certify_verdict: cert.verdict,
        card_count: cards.length, cards,
        note: "For full plan application use the local forge CLI.",
      } as unknown as JsonValue;
    }

    // ── Merged: lineage (replaces audit_list + why_did_this_change + what_failed_last_time) ──

    case "lineage": {
      // Auto-detect mode from args
      if (args.file || args.mode === "by_file") {
        // blame mode
        const { owner, name: repoName } = repo();
        const filePath = String(args.file ?? "");
        if (!filePath) throw new Error("file is required for by_file mode");
        return { schema_version: "atomadic-forge.lineage/v1", mode: "by_file", file: filePath, recent_commits: await gh.getFileCommits(owner, repoName, filePath) } as unknown as JsonValue;
      }
      if (args.area || args.mode === "failed_for_area") {
        // CI failure mode
        const { owner, name: repoName } = repo();
        const limit = typeof args.limit === "number" ? Math.min(args.limit, 10) : 5;
        return { schema_version: "atomadic-forge.lineage/v1", mode: "failed_for_area", area: String(args.area ?? ""), recent_failures: await gh.getRunFailures(owner, repoName, limit) } as unknown as JsonValue;
      }
      // audit_list mode
      if (!args.repo) {
        return {
          schema_version: "atomadic-forge.lineage/v1", mode: "all",
          note: "Local lineage chain (`.atomadic-forge/lineage.jsonl`) requires the local forge CLI.",
          instructions: "pip install atomadic-forge && forge lineage",
        } as unknown as JsonValue;
      }
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      return {
        schema_version: "atomadic-forge.lineage/v1", mode: "all", repo: `${owner}/${repoName}`,
        items: [
          { id: "receipt", status: files.some(f => f.includes(".forge")) ? "present" : "missing", detail: "Forge receipt (.forge/)" },
          { id: "ci", status: files.some(f => f.includes(".github/workflows")) ? "present" : "missing", detail: "CI workflow" },
          { id: "lineage", status: "unknown", detail: "Lineage chain — requires local forge CLI" },
        ],
      } as unknown as JsonValue;
    }

    case "select_tests": {
      const { owner, name: repoName } = repo();
      const changed = Array.isArray(args.changed_files)
        ? (args.changed_files as JsonValue[]).map(String) : [];
      if (!changed.length) throw new Error("changed_files is required");
      const files = await gh.getRepoFiles(owner, repoName);
      const testFiles = files.filter(f => /test_|_test\.|\.test\.|\.spec\./.test(f));
      const suggested = changed.flatMap(src => {
        const stem = src.split("/").pop()?.replace(/\.(py|ts|js)$/, "");
        return testFiles.filter(t => stem && t.includes(stem));
      });
      return { schema_version: "atomadic-forge.select_tests/v1", changed_files: changed, suggested_tests: [...new Set(suggested)].slice(0, 20), all_test_files: testFiles.slice(0, 50) } as unknown as JsonValue;
    }

    case "load_policy": {
      const { owner, name: repoName } = repo();
      try {
        const content = await gh.getFileContent(owner, repoName, ".forge/policy.yaml");
        return { schema_version: "atomadic-forge.policy/v1", source: ".forge/policy.yaml", content } as unknown as JsonValue;
      } catch {
        return { schema_version: "atomadic-forge.policy/v1", source: "default", policy: { tiers: ["a0_qk_constants", "a1_at_functions", "a2_mo_composites", "a3_og_features", "a4_sy_orchestration"], require_docstrings: true, import_direction: "strict" } } as unknown as JsonValue;
      }
    }

    case "compose_tools": {
      const { owner, name: repoName } = repo();
      const toolNames = Array.isArray(args.tools) ? (args.tools as JsonValue[]).map(String) : ["recon", "certify", "enforce"];
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      const results: Record<string, JsonValue> = {};
      for (const t of toolNames) {
        if (t === "recon") results.recon = recon as unknown as JsonValue;
        else if (t === "certify") results.certify = certifyRepo(recon) as unknown as JsonValue;
        else if (t === "enforce") {
          const v = [...recon.uncovered_files.map(f => `UNCOVERED: ${f}`), ...recon.naming_violations.map(f => `NAMING: ${f}`)];
          results.enforce = { violation_count: v.length, violations: v.slice(0, 20) } as unknown as JsonValue;
        }
      }
      return { schema_version: "atomadic-forge.compose/v1", tools_run: toolNames, results } as unknown as JsonValue;
    }

    // ── Merged: verify (replaces exported_api_check) ────────────────────

    case "verify": {
      if (args.check_exports) {
        const { owner, name: repoName } = repo();
        const base = String(args.base ?? "main");
        const head = String(args.head ?? "HEAD");
        const cmp = await gh.compareRefs(owner, repoName, base, head);
        const changedPy = (cmp.files ?? []).filter(f => /\.(py|ts|js)$/.test(f.filename));
        const publicFiles = changedPy.filter(f => f.filename.includes("__init__") || !/[_-]/.test(f.filename.split("/").pop() ?? ""));
        return { schema_version: "atomadic-forge.verify/v1", repo: `${owner}/${repoName}`, base, head, status: cmp.status, ahead_by: cmp.ahead_by, behind_by: cmp.behind_by, changed_source_files: changedPy.length, public_api_files_changed: publicFiles.map(f => f.filename), verdict: publicFiles.length === 0 ? "PASS" : "REVIEW" } as unknown as JsonValue;
      }
      // General verify: run wire + certify
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      const cert = certifyRepo(recon);
      return {
        schema_version: "atomadic-forge.verify/v1",
        repo: `${owner}/${repoName}`,
        certify_score: cert.score, certify_verdict: cert.verdict,
        wire_violations: recon.uncovered_files.filter(f => f.endsWith(".py")).length,
        verdict: cert.score >= 75 ? "PASS" : "FAIL",
      } as unknown as JsonValue;
    }

    // ── Discovery / composition ────────────────────────────────────────

    case "emergent_scan":
    case "emergent_swarm":
    case "synergy_scan": {
      if (name === "emergent_swarm") {
        const repos = Array.isArray(args.repos) ? (args.repos as JsonValue[]).map(String) : [];
        return {
          schema_version: "atomadic-forge.emergent_swarm/v1",
          repos_requested: repos.length,
          note: "Full multi-repo swarm requires the local forge CLI.",
          instructions: "pip install atomadic-forge && forge emergent swarm " + repos.slice(0, 3).join(" "),
        } as unknown as JsonValue;
      }
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      return {
        schema_version: `atomadic-forge.${name}/v1`,
        repo: `${owner}/${repoName}`,
        files_scanned: files.length,
        tier_distribution: recon.tier_map,
        candidates: [],
        note: `Full ${name} ranking pipeline requires the local Python CLI.`,
        instructions: `pip install atomadic-forge && forge ${name === "emergent_scan" ? "emergent scan ." : "synergy scan ."}`,
      } as unknown as JsonValue;
    }

    case "recon_swarm": {
      const repos = Array.isArray(args.repos) ? (args.repos as JsonValue[]).map(String) : [];
      if (!repos.length) throw new Error("repos is required");
      const results = await Promise.all(
        repos.slice(0, 10).map(async (r) => {
          try {
            const parsed = parseRepo(r);
            if (!parsed) return { repo: r, error: "invalid repo" };
            const files = await gh.getRepoFiles(parsed.owner, parsed.name);
            const recon = analyzeFiles(parsed.owner, parsed.name, files);
            const cert = certifyRepo(recon);
            return { repo: r, certify_score: cert.score, tier_map: recon.tier_map, violation_count: recon.uncovered_files.length };
          } catch (e) {
            return { repo: r, error: String(e) };
          }
        })
      );
      return { schema_version: "atomadic-forge.recon_swarm/v1", repos_scanned: results.length, results } as unknown as JsonValue;
    }

    case "smell_scan": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      const smells: string[] = [];
      if (recon.uncovered_files.length > 20) smells.push(`${recon.uncovered_files.length} files outside tier layout (God-module risk)`);
      if (recon.python_files > 200 && recon.tier_coverage < 50) smells.push("Low tier coverage on large repo (implicit a2 composite risk)");
      return {
        schema_version: "atomadic-forge.smell_scan/v1",
        repo: `${owner}/${repoName}`,
        smells_found: smells.length,
        smells,
        note: "Full smell scoring (docstring/oversized-file analysis) requires the local CLI.",
      } as unknown as JsonValue;
    }

    // ── Absorb pipeline ────────────────────────────────────────────────

    case "auto": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      const cert = certifyRepo(recon);
      return {
        schema_version: "atomadic-forge.auto/v1",
        repo: `${owner}/${repoName}`,
        pre_certify_score: cert.score, pre_certify_verdict: cert.verdict,
        tier_map: recon.tier_map,
        top_symbols: recon.uncovered_files.slice(0, 20),
        note: "Remote auto returns a pre-scan manifest. Full pipeline (scout → cherry → assimilate → wire → certify) requires the local CLI.",
        instructions: `pip install atomadic-forge && forge auto ${owner}/${repoName}`,
      } as unknown as JsonValue;
    }

    case "cherry":
    case "harvest": {
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      return {
        schema_version: `atomadic-forge.${name}/v1`,
        repo: `${owner}/${repoName}`,
        files_scanned: files.length,
        tier_map: recon.tier_map,
        candidates: recon.uncovered_files.slice(0, typeof args.top_n === "number" ? args.top_n : 30),
        note: `Full ${name} (AST-level symbol ranking) requires the local Python CLI.`,
        instructions: `pip install atomadic-forge && forge ${name} ${owner}/${repoName}`,
      } as unknown as JsonValue;
    }

    case "forge_locate": {
      const query = String(args.query ?? "");
      if (!query) throw new Error("query is required");
      const { owner, name: repoName } = args.repo
        ? (() => { const p = parseRepo(String(args.repo)); if (!p) throw new Error("Invalid repo"); return p; })()
        : { owner: "atomadictech", name: "atomadic-forge" };
      const files = await gh.getRepoFiles(owner, repoName);
      const matches = files.filter(f => f.toLowerCase().includes(query.toLowerCase())).slice(0, 20);
      return {
        schema_version: "atomadic-forge.forge_locate/v1",
        query, matches_found: matches.length, matches,
      } as unknown as JsonValue;
    }

    // ── Operational / diagnostic ─────────────────────────────────────

    case "doctor": {
      const base = {
        schema_version: "atomadic-forge.doctor/v1",
        runtime: "cloudflare-worker",
        worker_version: env.FORGE_VERSION,
        capabilities_remote: [
          "recon", "certify", "enforce", "wire",
          "context_pack", "score_patch", "preflight_change",
          "trust_gate_response", "verify",
          "lineage", "load_policy", "recipes",
          "manifest_diff (inline-dict mode)", "plan (fresh + adapt mode)",
          "emergent_scan", "emergent_swarm", "synergy_scan",
          "recon_swarm", "auto (pre-scan)", "cherry (manifest)", "harvest",
          "forge_locate", "smell_scan", "commit_compose",
          "welcome (remote situation report)",
          "nexus_* (7 Nexus primitives, when keys configured)",
        ],
        capabilities_local_only: [
          "plan_apply", "finalize", "rollback_plan",
          "sidecar_validate", "doctor (Python env detail)",
          "call_graph", "cna_check", "tool_factory", "guard_install",
          "iterate_start", "iterate_continue", "evolve_start", "evolve_step",
          "emergent_scan / synergy_scan (full AST pipeline)",
          "wisdom_record", "wisdom_query", "wisdom_list", "wisdom_recall", "wisdom_promote",
          "hive_register", "hive_list", "hive_deactivate", "hive_observe",
          "hive_propose", "hive_vote", "hive_result", "hive_recap", "hive_needs_vote",
          "handoff_create", "handoff_list",
          "enhancement_propose", "enhancement_list",
        ],
        instructions: "For local-only tools and full features, install the CLI: `pip install atomadic-forge && forge mcp serve`",
        docs: "https://forge.atomadic.tech",
      };
      // include_worktree requests git state — local-only
      if (args.include_worktree) {
        return { ...base, worktree: localOnlyRedirect("worktree_status") } as unknown as JsonValue;
      }
      return base as unknown as JsonValue;
    }

    case "manifest_diff": {
      const left = (args.left ?? null) as Record<string, JsonValue> | null;
      const right = (args.right ?? null) as Record<string, JsonValue> | null;
      if (!left || !right) {
        return {
          schema_version: "atomadic-forge.manifest_diff/v1",
          note: "Inline-dict mode needs both `left` and `right` objects. For path-based diffing, use the local CLI.",
          instructions: "pip install atomadic-forge && forge diff <left> <right>",
        } as unknown as JsonValue;
      }
      const leftKeys = new Set(Object.keys(left));
      const rightKeys = new Set(Object.keys(right));
      const added_keys = [...rightKeys].filter((k) => !leftKeys.has(k));
      const removed_keys = [...leftKeys].filter((k) => !rightKeys.has(k));
      const symbolList = (m: Record<string, JsonValue>) => {
        const syms = m.symbols;
        if (!Array.isArray(syms)) return [] as string[];
        return (syms as Array<Record<string, JsonValue>>).map(
          (s) => String(s.qualname ?? s.name ?? "")
        ).filter(Boolean);
      };
      const lset = new Set(symbolList(left));
      const rset = new Set(symbolList(right));
      const added_symbols = [...rset].filter((s) => !lset.has(s));
      const removed_symbols = [...lset].filter((s) => !rset.has(s));
      return {
        schema_version: "atomadic-forge.manifest_diff/v1",
        left_schema: String(left.schema_version ?? ""),
        right_schema: String(right.schema_version ?? ""),
        added_keys, removed_keys, added_symbols, removed_symbols,
        compatible: added_keys.length === 0 && removed_keys.length === 0,
      } as unknown as JsonValue;
    }

    // ── Local-only stubs ────────────────────────────────────────────────

    case "plan_apply":
    case "rollback_plan":
    case "sidecar_validate":
    case "finalize":
    case "call_graph":
    case "cna_check":
    case "tool_factory":
    case "guard_install":
    case "iterate_start":
    case "iterate_continue":
    case "evolve_start":
    case "evolve_step":
      return localOnlyRedirect(name);

    // ── v0.13.x Wisdom DB (local-only: reads .atomadic-forge/wisdom.jsonl) ──

    case "wisdom_record":
    case "wisdom_query":
    case "wisdom_list":
    case "wisdom_recall":
    case "wisdom_promote":
      return localOnlyRedirect(name);

    // ── v0.13.x Hive Sync (local-only: reads .atomadic-forge/hive/) ─────

    case "hive_register":
    case "hive_list":
    case "hive_deactivate":
    case "hive_observe":
    case "hive_propose":
    case "hive_vote":
    case "hive_result":
    case "hive_recap":
    case "hive_needs_vote":
      return localOnlyRedirect(name);

    // ── v0.14.0a7 AAAA-Nexus LIVE Primitives ────────────────────────────
    // These proxy to the deployed Nexus service when keys are configured;
    // otherwise return a redirect to the local CLI.

    case "nexus_identity_verify":
    case "nexus_federation_mint":
    case "nexus_authorize_action":
    case "nexus_sys_trust_gate":
    case "nexus_contract_verify":
    case "nexus_lineage_record":
    case "nexus_ratchet_register": {
      const nexusKey = env.ATOMADIC_MASTER_KEY || env.ATOMADIC_SUBSCRIPTION_KEY || "";
      if (!nexusKey) {
        return {
          schema_version: `atomadic-forge.${name}/v1`,
          note: `${name} requires ATOMADIC_MASTER_KEY or ATOMADIC_SUBSCRIPTION_KEY in env.`,
          instructions: "Configure Nexus keys or use the local CLI: pip install atomadic-forge && forge mcp serve",
        } as unknown as JsonValue;
      }
      // Strip the nexus_ prefix to get the Nexus primitive name.
      const primitive = name.replace("nexus_", "");
      const nexusOrigin = env.NEXUS_ORIGIN || "https://atomadic-cognition.atomadictech.workers.dev";
      try {
        const resp = await fetch(`${nexusOrigin}/nexus/${primitive}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": nexusKey },
          body: JSON.stringify(args),
        });
        const data = await resp.json().catch(() => null);
        return { schema_version: `atomadic-forge.${name}/v1`, ...(data ?? { error: `HTTP ${resp.status}` }) } as unknown as JsonValue;
      } catch (err) {
        return { schema_version: `atomadic-forge.${name}/v1`, error: String(err) } as unknown as JsonValue;
      }
    }

    // ── v0.14.0a9 Handoff (local-only: writes .atomadic-forge/handoffs/) ─

    case "handoff_create":
    case "handoff_list":
      return localOnlyRedirect(name);

    // ── v0.14.0a11 Enhancement Proposals (local-only) ────────────────────

    case "enhancement_propose":
    case "enhancement_list":
      return localOnlyRedirect(name);

    // ── v0.14.0a12 Welcome ───────────────────────────────────────────────

    case "welcome": {
      // Remote welcome: run recon + certify and compose a situational report.
      if (!args.repo) {
        return {
          schema_version: "atomadic-forge.welcome/v1",
          note: "Remote welcome requires a repo arg. For local welcome, use `pip install atomadic-forge && forge mcp serve`.",
          instructions: "Pass repo='owner/repo' for a remote situation report.",
        } as unknown as JsonValue;
      }
      const { owner, name: repoName } = repo();
      const files = await gh.getRepoFiles(owner, repoName);
      const recon = analyzeFiles(owner, repoName, files);
      const cert = certifyRepo(recon);
      const strengths: string[] = [];
      if (cert.score >= 75) strengths.push("Certify score above threshold");
      if (recon.tier_coverage > 60) strengths.push("Strong 5-tier coverage");
      if (recon.test_file_count > 5) strengths.push("Active test suite");
      return {
        schema_version: "atomadic-forge.welcome/v1",
        repo: `${owner}/${repoName}`,
        certify_score: cert.score,
        certify_verdict: cert.verdict,
        total_files: recon.total_files,
        python_files: recon.python_files,
        test_files: recon.test_file_count,
        tier_coverage_pct: recon.tier_coverage,
        tier_map: recon.tier_map,
        top_strengths: strengths.slice(0, 3),
        top_priorities: cert.recommendations.slice(0, 3),
        next_call: cert.score < 75 ? "plan" : "verify",
        capability_showcase: {
          "Architecture Analysis": ["recon", "certify", "enforce", "wire"],
          "Refactor Planning": ["plan", "plan_apply", "auto", "cherry"],
          "Code Intelligence": ["call_graph", "smell_scan", "forge_locate", "cna_check"],
          "Cross-Repo": ["recon_swarm", "emergent_swarm", "harvest"],
          "Wisdom & Hive": ["wisdom_record", "wisdom_query", "hive_propose", "hive_vote"],
          "Trust & Safety": ["trust_gate_response", "verify", "guard_install"],
        },
        safety_net: {
          trust_gate: "Every agent output can be validated via trust_gate_response before apply.",
          lineage: "All actions recorded to .atomadic-forge/lineage.jsonl.",
          rollback: "rollback_plan generates structured undo for any change.",
        },
        note: "Full welcome with narrative, agent_guidance, and since-receipt diff requires the local CLI.",
      } as unknown as JsonValue;
    }

    default:
      throw { code: -32601, message: `Unknown tool: ${name}` };
  }
}
