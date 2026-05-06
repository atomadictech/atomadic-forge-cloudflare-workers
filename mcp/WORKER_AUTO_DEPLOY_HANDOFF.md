# Forge Worker auto-deploy handoff

> Doc/Orchestrator — 2026-05-06T05:22Z (T-9h to Boris demo)
>
> **Owner directive**: "Make sure the forge worker has the latest
> version and we need to somehow automate the worker update whenever
> we push a new version to github with the version tag.  So all users
> who connect will always use the latest mcp and forge version."

## Current state — and why "latest" never propagates

| Surface | Version | Source |
|---------|---------|--------|
| `pip install atomadic-forge` | **`0.14.0`** | PyPI (auto-published from `atomadictech/atomadic-forge` on tag) |
| `forge` CLI / local pip MCP | **`0.14.0`** | same |
| `forge.atomadic.tech/mcp` Worker | **`0.10.0`** ← four minor versions behind | manual `wrangler deploy` |
| Worker source | local files only at `C:\!!AtomadicStandard\atomadic-forge-cloudflare-workers\mcp\` | **NO git remote, NO CI** |

Live evidence (2026-05-06T05:18Z):

```bash
$ curl -X POST https://forge.atomadic.tech/mcp \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $FORGE_MASTER_API_KEY" \
     --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"doctor","arguments":{}}}'

# {"runtime": "cloudflare-worker", "worker_version": "0.10.0", ...}
```

## Why this is a Boris-demo P0

Research agent caught it (`WIS-research-worker-version-drift`,
`WIS-research-worker-cli-score-divergence` on `atomadic-forge`):

- Worker v0.10.0 has the **Python-only tier classifier**.
- Local CLI v0.14.0 has the **polyglot TS/JS/Python classifier**.
- Same repo certified through Worker vs local CLI returns **different scores** (hono: Worker=30, CLI=55; atomadic-forge: Worker=80, CLI=100).
- Atomadic's chat-led `FORGE_DEMO` action calls the **Worker** via `callForgeService`, so an autonomous chat-led demo will **not reproduce captured terminal numbers**.

## Why the Worker can't auto-update today

The Python repo `atomadictech/atomadic-forge` has the full release pipeline
(GitHub Actions on tag → PyPI publish + GitHub Release).  But the **Worker
source isn't there**.  It's in a sibling local directory that:

1. has no `.git` folder
2. is not in any GitHub repo
3. has no `wrangler.toml [build]` triggered from CI
4. was never linked to the Python release tag

So pushing a new tag to `atomadic-forge` does nothing for the Worker.  No
matter how many `v0.14.x` releases ship, `forge.atomadic.tech/mcp` keeps
serving `0.10.0` until someone runs `wrangler deploy` manually.

## The fix path (4 steps, all out of orchestrator scope)

### Step 1 — get the Worker source onto GitHub

Two options.  Both are dev/ops decisions for Thomas + Forge agent.

**Option A: dedicated repo** (clean separation)

```bash
cd C:\!!AtomadicStandard\atomadic-forge-cloudflare-workers
git init
git add .
git commit -m "initial: forge MCP Worker (was local-only)"
gh repo create atomadictech/atomadic-forge-cloudflare-workers --public \
    --description "Cloudflare Worker hosting forge.atomadic.tech/mcp"
git push -u origin main
```

**Option B: subfolder of atomadic-forge** (shares CI + version)

```bash
cd C:\!!AtomadicStandard\atomadic-forge
mkdir -p cloudflare-workers
cp -r ../atomadic-forge-cloudflare-workers/mcp cloudflare-workers/mcp
git add cloudflare-workers/
git commit -m "feat(worker): import MCP Worker source for CI auto-deploy"
git push origin main
```

**Doc/Orchestrator's recommendation: Option B.**  Reasons:

- Worker version SHOULD track Python release version — they're tied conceptually.
- The same release tag (`v0.14.0`) can fan out to PyPI AND wrangler deploy in one workflow.
- Less repo-management overhead.
- Forge agent already maintains the Python CI; adding wrangler is incremental.

### Step 2 — add the auto-deploy workflow

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy Forge MCP Worker

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v6
        with:
          node-version: 20

      - name: Sync Worker version with release tag
        working-directory: cloudflare-workers/mcp
        run: |
          v="${GITHUB_REF_NAME#v}"
          npm pkg set version="$v"
          # Inline the version into the doctor response so the runtime
          # reports it without a separate import.
          sed -i "s/\"worker_version\": \"[^\"]*\"/\"worker_version\": \"$v\"/" src/a4_sy_orchestration/index.ts

      - name: Install
        working-directory: cloudflare-workers/mcp
        run: npm ci

      - name: Typecheck
        working-directory: cloudflare-workers/mcp
        run: npm run typecheck

      - name: Deploy
        working-directory: cloudflare-workers/mcp
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler deploy --var WORKER_VERSION:"${GITHUB_REF_NAME#v}"
```

### Step 3 — add Cloudflare secrets to the repo

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo atomadictech/atomadic-forge
gh secret set CLOUDFLARE_ACCOUNT_ID --repo atomadictech/atomadic-forge
```

(Token needs `Workers Scripts: Edit` + `Account: Read`.  Operator already
has these in `.env`.)

### Step 4 — port the v0.10.0 → v0.14.x deltas into the TS Worker

This is the part that's **NOT free**.  The Worker is a TS port of the
Python tier classifier; it lags the Python source.  v0.14.0's polyglot
classifier (TS/JS/Python tier detection, score 55/100 on hono / atproto /
fastapi / express) needs to be ported into `cloudflare-workers/mcp/src/`.

Proposed scope split:

- **Forge agent** writes the TS port of the polyglot classifier.
- **Cognition agent** updates `callForgeService` to read the Worker's
  reported `worker_version` and degrade gracefully if the Worker is older
  than the local CLI.
- **Doc agent** (this file) tracks the bump in the README + status report.

## Interim mitigation for Boris demo (T-9h)

Per `WIS-research-worker-explain-rescue` (committed 2026-05-06T04:46Z):

- The Worker's `explain_repo` tool returns GitHub metadata + a basic
  certify_score.  It IS demoable.
- **Path**: chat-led demo skips `recon`/`certify`, uses `explain_repo`,
  discloses **once** that this is the hosted lighter version.
- Backup: terminal-led path (`run_demo_live.bat`) uses the local CLI
  v0.14.0 directly — bulletproof reproduction of captured numbers.

## Verdict

**REFINE** — auto-deploy infrastructure does not exist; bringing the
Worker to parity with the Python release is product/ops work, not
orchestration.  Doc agent has documented the gap, the fix path, and
the demo-time mitigation.  Action lies with Thomas (Option A vs B
choice) and the Forge / Cognition agents (CI + classifier port).

— Docs/Orchestrator
  2026-05-06T05:22Z
