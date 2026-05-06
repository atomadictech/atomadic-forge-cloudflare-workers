# Atomadic Forge — Cloudflare Workers

Deployed Workers that front the [`atomadic-forge`](https://github.com/atomadictech/atomadic-forge)
architecture compiler over HTTP.

## Workers

| Worker | Path | URL | Purpose |
|--------|------|-----|---------|
| **MCP** | [`mcp/`](mcp/) | `https://forge.atomadic.tech/mcp` | MCP Streamable HTTP server (spec 2025-11-25). Smithery, Claude Desktop HTTP, and any MCP client that prefers a URL over a subprocess. |
| **Badge** | [`badge/`](badge/) | `https://forge.atomadic.tech/badge/...` | Repo certification badges. |

## Auto-deploy

`.github/workflows/deploy-mcp.yml` triggers on:

- **Push to `main`** that touches `mcp/**` or the workflow itself
- **Tag push matching `v*`** (e.g. `v0.14.1`, `v0.15.0`) — recommended for releases; the tag name becomes the inline `worker_version` reported by the `doctor` MCP tool.
- **Manual `workflow_dispatch`** — with an optional `version` input.

The workflow:

1. Resolves the version (tag → strip `v` prefix; manual → input; branch push → read `package.json`)
2. Rewrites `mcp/package.json:version`, `mcp/wrangler.toml:FORGE_VERSION`, and the literal `"worker_version": "..."` in `mcp/src/` so the live `doctor` tool reports the shipped version
3. Installs deps, typechecks, runs `wrangler deploy`
4. Smoke-checks the live endpoint via `POST /mcp tools/call doctor`

## Required GitHub repo secrets

| Secret | Source |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens. Needs `Workers Scripts: Edit` + `Account: Read` for the Atomadic account. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID. |
| `FORGE_MASTER_API_KEY` *(optional)* | Used only by the smoke-check step to authenticate against `forge.atomadic.tech/mcp`. Skip if you want unauthed smoke. |

Set with:

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo atomadictech/atomadic-forge-cloudflare-workers
gh secret set CLOUDFLARE_ACCOUNT_ID --repo atomadictech/atomadic-forge-cloudflare-workers
gh secret set FORGE_MASTER_API_KEY --repo atomadictech/atomadic-forge-cloudflare-workers
```

## Manual deploy (legacy / emergency)

```bash
cd mcp
npm install
npx wrangler deploy
```

## Versioning policy

Worker version SHOULD track the [`atomadic-forge`](https://github.com/atomadictech/atomadic-forge)
Python release tag.  When `atomadic-forge v0.14.1` ships to PyPI, push a
matching `v0.14.1` tag to this repo and the workflow ships the Worker
to the same surface.  The TS classifier in `mcp/src/` is a separate
codebase and does NOT auto-sync with the Python tier classifier — that
port is a deliberate engineering pass each release.

## Reference

Full background + the four-step bring-up plan: [atomadic-forge `docs/handoffs/WORKER_AUTO_DEPLOY_2026-05-06.md`](https://github.com/atomadictech/atomadic-forge/blob/main/docs/handoffs/WORKER_AUTO_DEPLOY_2026-05-06.md).
