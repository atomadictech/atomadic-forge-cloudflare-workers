/** Tier a3 — feature: routes tool calls to their implementations. v0.10.0 surface. */

import { Env, JsonValue } from "../a0_qk_constants/types.ts";
import { RECIPES } from "../a0_qk_constants/recipes.ts";
import { parseRepo } from "../a1_at_functions/repo_parser.ts";
import { analyzeFiles, certifyRepo } from "../a1_at_functions/certify_repo.ts";
import { scorePatch } from "../a1_at_functions/score_patch.ts";
import { trustGateResponse } from "../a1_at_functions/trust_gate.ts";
import { preflightChange } from "../a1_at_functions/preflight.ts";
import { GitHubClient } from "../a2_mo_composites/github_client.ts";

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
  const gh = new GitHubClient(env);

  /** Resolve and validate a repo arg, returning parsed owner/name. */
  function repo() {
    const parsed = parseRepo(String(args.repo ?? ""));
    if (!parsed) throw new Error("Invalid repo: use 'owner/repo' or a GitHub URL");
    return parsed;
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
        ],
        capabilities_local_only: [
          "plan_apply", "finalize", "rollback_plan",
          "sidecar_validate", "doctor (Python env detail)",
          "call_graph", "cna_check", "tool_factory", "guard_install",
          "iterate_start", "iterate_continue", "evolve_start", "evolve_step",
          "emergent_scan / synergy_scan (full AST pipeline)",
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

    default:
      throw { code: -32601, message: `Unknown tool: ${name}` };
  }
}
