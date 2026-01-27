/**
 * Parse a git remote URL to extract provider, owner, and repo.
 * Handles both HTTPS and SSH formats for GitHub, GitLab, and Bitbucket.
 */

export type GitProvider = "github" | "gitlab" | "bitbucket" | null;

export interface ParsedRemoteUrl {
  provider: GitProvider;
  owner: string | null;
  repo: string | null;
  /** Full HTTPS URL to the repo (e.g. "https://github.com/owner/repo") */
  repoUrl: string | null;
}

const HOST_TO_PROVIDER: Record<string, GitProvider> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "bitbucket.org": "bitbucket",
};

const KNOWN_HOSTS = Object.keys(HOST_TO_PROVIDER)
  .join("|")
  .replace(/\./g, "\\.");

const HTTPS_RE = new RegExp(`https?://(${KNOWN_HOSTS})/([^/]+)/([^/]+)`);

const SSH_RE = new RegExp(`git@(${KNOWN_HOSTS}):([^/]+)/(.+)`);

export function parseGitRemoteUrl(url: string): ParsedRemoteUrl {
  let normalized = url.trim();
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -4);
  }

  const httpsMatch = normalized.match(HTTPS_RE);
  if (httpsMatch) {
    const [, host, owner, repo] = httpsMatch;
    const provider = HOST_TO_PROVIDER[host!] ?? null;
    return {
      provider,
      owner: owner || null,
      repo: repo || null,
      repoUrl: `https://${host}/${owner}/${repo}`,
    };
  }

  const sshMatch = normalized.match(SSH_RE);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    const provider = HOST_TO_PROVIDER[host!] ?? null;
    return {
      provider,
      owner: owner || null,
      repo: repo || null,
      repoUrl: `https://${host}/${owner}/${repo}`,
    };
  }

  return { provider: null, owner: null, repo: null, repoUrl: null };
}
