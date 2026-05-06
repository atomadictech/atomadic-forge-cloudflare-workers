/** Tier a2 — stateful GitHub API client (wraps fetch with auth + rate-limit handling). */

import { Env } from "../a0_qk_constants/types.ts";

export class GitHubClient {
  private readonly headers: Record<string, string>;

  constructor(env: Env) {
    this.headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "atomadic-forge-mcp/0.10.0",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (env.GITHUB_TOKEN) {
      this.headers["Authorization"] = `Bearer ${env.GITHUB_TOKEN}`;
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, { headers: this.headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  }

  async getRepoMeta(owner: string, name: string): Promise<{
    default_branch: string;
    description?: string;
    language?: string;
    stargazers_count?: number;
    open_issues_count?: number;
  }> {
    return this.get(`/repos/${owner}/${name}`);
  }

  async getTree(owner: string, name: string, branch: string): Promise<string[]> {
    const data = await this.get<{ tree: { path: string; type: string }[] }>(
      `/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
    );
    return (data.tree ?? []).filter(f => f.type === "blob").map(f => f.path);
  }

  async getFileContent(owner: string, name: string, path: string): Promise<string> {
    const data = await this.get<{ content?: string; encoding?: string }>(
      `/repos/${owner}/${name}/contents/${encodeURIComponent(path)}`,
    );
    if (data.encoding === "base64" && data.content) {
      return atob(data.content.replace(/\n/g, ""));
    }
    throw new Error(`Unexpected encoding: ${data.encoding}`);
  }

  async getRepoFiles(owner: string, name: string): Promise<string[]> {
    const meta = await this.getRepoMeta(owner, name);
    return this.getTree(owner, name, meta.default_branch ?? "main");
  }

  async getRunFailures(owner: string, name: string, limit: number): Promise<unknown[]> {
    const data = await this.get<{
      workflow_runs: Array<{
        id: number; name: string; head_branch: string;
        conclusion: string; created_at: string; html_url: string;
      }>;
    }>(`/repos/${owner}/${name}/actions/runs?per_page=${limit}&status=failure`);
    return (data.workflow_runs ?? []).map(r => ({
      id: r.id, workflow: r.name, branch: r.head_branch,
      conclusion: r.conclusion, created_at: r.created_at, url: r.html_url,
    }));
  }

  async getFileCommits(owner: string, name: string, filePath: string): Promise<unknown[]> {
    const commits = await this.get<Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      html_url: string;
    }>>(`/repos/${owner}/${name}/commits?path=${encodeURIComponent(filePath)}&per_page=5`);
    return commits.slice(0, 5).map(c => ({
      sha: c.sha.slice(0, 8),
      message: c.commit.message.split("\n")[0],
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    }));
  }

  async compareRefs(owner: string, name: string, base: string, head: string): Promise<{
    status: string; ahead_by: number; behind_by: number;
    files?: Array<{ filename: string; status: string; changes: number }>;
  }> {
    return this.get(`/repos/${owner}/${name}/compare/${base}...${head}`);
  }
}
