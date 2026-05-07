/** Tier a3 — feature: MCP JSON-RPC request handler. */

import { Env, JsonValue, McpRequest, McpResponse } from "../a0_qk_constants/types.ts";
import { TOOLS, DELUXE_TOOLS_TOTAL, LEGACY_ENDPOINT_MAP } from "../a0_qk_constants/tools_catalog.ts";
import { JSONRPC, PROTOCOL_VERSION, SERVER_NAME, SERVER_VERSION, ERR_METHOD_NOT_FOUND, ERR_INVALID_PARAMS, ERR_INTERNAL } from "../a0_qk_constants/tier_patterns.ts";
import { dispatchTool } from "./tool_dispatcher.ts";

export async function handleMcpRequest(req: McpRequest, env: Env, apiKey: string | null = null, isDeluxe = false): Promise<McpResponse> {
  const id = req.id ?? null;

  try {
    switch (req.method) {

      case "initialize": {
        const toolCount = isDeluxe ? DELUXE_TOOLS_TOTAL : TOOLS.length;
        const tier = isDeluxe ? "Deluxe" : "Standard";
        return {
          jsonrpc: JSONRPC, id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false }, resources: {} },
            serverInfo: { name: isDeluxe ? "atomadic-forge-deluxe" : SERVER_NAME, version: SERVER_VERSION },
            instructions:
              `Atomadic Forge ${tier} MCP — ${toolCount} tools for architecture analysis, conformance scoring, and refactor planning. ` +
              "Remote tools accept GitHub repo URLs (e.g. 'atomadictech/atomadic-forge'). " +
              `For local file mutations use \`pip install atomadic-forge${isDeluxe ? "-deluxe" : ""}\` and run \`forge mcp serve\`.`,
          },
        };
      }

      case "ping":
      case "notifications/initialized":
        return { jsonrpc: JSONRPC, id, result: {} };

      case "tools/list":
        return { jsonrpc: JSONRPC, id, result: { tools: TOOLS as unknown as JsonValue[] } };

      case "tools/call": {
        const params = req.params ?? {};
        const toolName = String(params.name ?? "");
        const args = (params.arguments ?? {}) as Record<string, JsonValue>;
        if (!toolName) {
          return { jsonrpc: JSONRPC, id, error: { code: ERR_INVALID_PARAMS, message: "name is required" } };
        }
        // v0.47.0: accept new tool names AND legacy names that the
        // dispatcher will redirect via LEGACY_ENDPOINT_MAP.
        const isKnown = TOOLS.some(t => t.name === toolName) || (toolName in LEGACY_ENDPOINT_MAP);
        if (!isKnown) {
          return { jsonrpc: JSONRPC, id, error: { code: ERR_METHOD_NOT_FOUND, message: `Tool '${toolName}' not found` } };
        }
        const result = await dispatchTool(toolName, args, env);
        return {
          jsonrpc: JSONRPC, id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: false },
        };
      }

      case "resources/list":
        return { jsonrpc: JSONRPC, id, result: { resources: [{ uri: "forge://docs", name: "Atomadic Forge Docs", description: "forge.atomadic.tech", mimeType: "text/plain" }] } };

      case "shutdown":
        return { jsonrpc: JSONRPC, id, result: {} };

      default:
        return { jsonrpc: JSONRPC, id, error: { code: ERR_METHOD_NOT_FOUND, message: `Method '${req.method}' not found` } };
    }
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err) {
      const e = err as { code: number; message: string };
      return { jsonrpc: JSONRPC, id, error: { code: e.code, message: e.message } };
    }
    return { jsonrpc: JSONRPC, id, error: { code: ERR_INTERNAL, message: err instanceof Error ? err.message : String(err) } };
  }
}
