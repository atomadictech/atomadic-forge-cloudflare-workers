/** Tier a4 — HTTP entry point: routes requests and applies CORS. */

import { Env } from "../a0_qk_constants/types.ts";
import { TOOLS, DELUXE_TOOLS_TOTAL } from "../a0_qk_constants/tools_catalog.ts";
import { SERVER_NAME, SERVER_VERSION, JSONRPC, ERR_PARSE } from "../a0_qk_constants/tier_patterns.ts";
import { handleMcpRequest } from "../a3_og_features/mcp_handler.ts";
import { extractKey } from "../a2_mo_composites/forge_auth.ts";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    if (url.pathname === "/mcp" && request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ jsonrpc: JSONRPC, id: null, error: { code: ERR_PARSE, message: "Parse error: invalid JSON" } }),
          { status: 400, headers: { "Content-Type": "application/json", ...cors() } },
        );
      }

      if (Array.isArray(body)) {
        const responses = await Promise.all(body.map(r => handleMcpRequest(r, env)));
        return new Response(JSON.stringify(responses), { headers: { "Content-Type": "application/json", ...cors() } });
      }

      const response = await handleMcpRequest(body as Parameters<typeof handleMcpRequest>[0], env);
      return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json", ...cors() } });
    }

    if (url.pathname === "/deluxe/mcp" && request.method === "POST") {
      const key = extractKey(request);
      const isDeluxeKey = key !== null && (key.startsWith("fk_dlx_") || key.startsWith("ak_master_"));
      if (!isDeluxeKey) {
        return new Response(
          JSON.stringify({ jsonrpc: JSONRPC, id: null, error: { code: -32402, message: "Payment required — a Deluxe (fk_dlx_) or Master (ak_master_) key is needed for /deluxe/mcp" } }),
          { status: 402, headers: { "Content-Type": "application/json", ...cors() } },
        );
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ jsonrpc: JSONRPC, id: null, error: { code: ERR_PARSE, message: "Parse error: invalid JSON" } }),
          { status: 400, headers: { "Content-Type": "application/json", ...cors() } },
        );
      }

      if (Array.isArray(body)) {
        const responses = await Promise.all(body.map(r => handleMcpRequest(r, env, key, true)));
        return new Response(JSON.stringify(responses), { headers: { "Content-Type": "application/json", ...cors() } });
      }

      const response = await handleMcpRequest(body as Parameters<typeof handleMcpRequest>[0], env, key, true);
      return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json", ...cors() } });
    }

    if (url.pathname === "/.well-known/mcp.json") {
      return Response.json({
        schema_version: "mcp/2025-11-25",
        name: SERVER_NAME, version: SERVER_VERSION,
        description: `Atomadic Forge Standard — ${TOOLS.length} remote tools for 5-tier monadic conformance scoring, refactor planning, and patch quality gates.`,
        endpoint: `${url.origin}/mcp`,
        transport: "streamable-http",
        tools_count: TOOLS.length,
        homepage: "https://forge.atomadic.tech",
      }, { headers: cors() });
    }

    if (url.pathname === "/deluxe/.well-known/mcp.json") {
      return Response.json({
        schema_version: "mcp/2025-11-25",
        name: "atomadic-forge-deluxe", version: SERVER_VERSION,
        description: `Atomadic Forge Deluxe — ${DELUXE_TOOLS_TOTAL} tools total (${TOOLS.length} remote + ${DELUXE_TOOLS_TOTAL - TOOLS.length} local). Full architecture stack: emergent/synergy scan, SBOM, ROI, commandsmith, evolution cycle, and more.`,
        endpoint: `${url.origin}/deluxe/mcp`,
        transport: "streamable-http",
        tools_count: DELUXE_TOOLS_TOTAL,
        homepage: "https://forge.atomadic.tech",
      }, { headers: cors() });
    }

    if (url.pathname === "/health" || url.pathname === "/") {
      return Response.json({
        status: "ok", service: "atomadic-forge-mcp", version: SERVER_VERSION,
        mcp_endpoint: `${url.origin}/mcp`, tools: TOOLS.length,
        docs: "https://forge.atomadic.tech",
        metrics: `${url.origin}/metrics.json`,
      }, { headers: cors() });
    }

    // v0.49.0 — proxy the canonical forge_metrics.json from the GitHub
    // raw URL so atomadic.tech / shields.io / any public surface always
    // sees the live counts the local CLI just regenerated.
    if (url.pathname === "/metrics.json" || url.pathname === "/forge_metrics.json") {
      try {
        const upstream = await fetch(
          "https://raw.githubusercontent.com/atomadictech/atomadic-forge/main/forge_metrics.json",
          { cf: { cacheTtl: 300, cacheEverything: true } as RequestInitCfProperties },
        );
        if (!upstream.ok) {
          return Response.json({
            error: `upstream ${upstream.status}`,
            schema_version: "atomadic-forge.metrics/v1",
          }, { status: 502, headers: cors() });
        }
        const body = await upstream.text();
        return new Response(body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            ...cors(),
          },
        });
      } catch (err) {
        return Response.json({
          error: err instanceof Error ? err.message : String(err),
          schema_version: "atomadic-forge.metrics/v1",
        }, { status: 502, headers: cors() });
      }
    }

    return new Response("Not found", { status: 404, headers: cors() });
  },
};
