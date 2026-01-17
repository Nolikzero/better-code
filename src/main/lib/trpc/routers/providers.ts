import { z } from "zod"
import { publicProcedure, router } from "../index"
import { getClaudeBinaryPath } from "../../claude/env"
import { getCodexBinaryPath, getCodexOAuthToken } from "../../codex/env"
import { execSync } from "child_process"

// Provider ID type
type ProviderId = "claude" | "codex"

// Model definition
interface ProviderModel {
  id: string
  name: string
  displayName: string
}

// Provider status
interface ProviderStatus {
  id: ProviderId
  name: string
  description: string
  available: boolean
  authStatus: {
    authenticated: boolean
    method?: "oauth" | "api-key"
    error?: string
  }
  models: ProviderModel[]
  binaryPath?: string
  binarySource?: string
}

/**
 * Check Claude authentication status
 */
function getClaudeAuthStatus(): {
  authenticated: boolean
  method?: "oauth" | "api-key"
  error?: string
} {
  if (process.platform !== "darwin") {
    // Non-macOS: check for API key in env
    if (process.env.ANTHROPIC_API_KEY) {
      return { authenticated: true, method: "api-key" }
    }
    return { authenticated: false, error: "No credentials found" }
  }

  try {
    const output = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim()

    if (output) {
      const credentials = JSON.parse(output)
      if (credentials?.claudeAiOauth?.accessToken) {
        return { authenticated: true, method: "oauth" }
      }
    }
  } catch {
    // Keychain entry not found
  }

  // Check for API key as fallback
  if (process.env.ANTHROPIC_API_KEY) {
    return { authenticated: true, method: "api-key" }
  }

  return { authenticated: false, error: "Not logged in to Claude Code CLI" }
}

/**
 * Check Codex authentication status
 */
function getCodexAuthStatus(): {
  authenticated: boolean
  method?: "oauth" | "api-key"
  error?: string
} {
  // Check environment variable first
  if (process.env.OPENAI_API_KEY) {
    return { authenticated: true, method: "api-key" }
  }

  // Check Codex OAuth token
  const token = getCodexOAuthToken()
  if (token) {
    return {
      authenticated: true,
      method: token.startsWith("sk-") ? "api-key" : "oauth",
    }
  }

  return { authenticated: false, error: "No OpenAI API key or Codex login found" }
}

/**
 * Get all provider statuses
 */
function getAllProviderStatuses(): ProviderStatus[] {
  // Claude provider
  const claudeBinary = getClaudeBinaryPath()
  const claudeAuth = getClaudeAuthStatus()

  const claudeStatus: ProviderStatus = {
    id: "claude",
    name: "Claude Code",
    description: "Anthropic's Claude AI assistant for coding",
    available: claudeBinary !== null,
    authStatus: claudeAuth,
    models: [
      { id: "opus", name: "opus", displayName: "Opus 4.5" },
      { id: "sonnet", name: "sonnet", displayName: "Sonnet 4.5" },
      { id: "haiku", name: "haiku", displayName: "Haiku 4.5" },
    ],
    binaryPath: claudeBinary?.path,
    binarySource: claudeBinary?.source,
  }

  // Codex provider
  const codexBinary = getCodexBinaryPath()
  const codexAuth = getCodexAuthStatus()

  const codexStatus: ProviderStatus = {
    id: "codex",
    name: "OpenAI Codex",
    description: "OpenAI's Codex CLI for coding assistance",
    available: codexBinary !== null,
    authStatus: codexAuth,
    models: [
      { id: "gpt-5.2-codex", name: "gpt-5.2-codex", displayName: "GPT-5.2 Codex" },
      { id: "gpt-5.1-codex-max", name: "gpt-5.1-codex-max", displayName: "GPT-5.1 Codex Max" },
      { id: "gpt-5.1-codex-mini", name: "gpt-5.1-codex-mini", displayName: "GPT-5.1 Codex Mini" },
      { id: "gpt-5.2", name: "gpt-5.2", displayName: "GPT-5.2" },
    ],
    binaryPath: codexBinary?.path,
    binarySource: codexBinary?.source,
  }

  return [claudeStatus, codexStatus]
}

export const providersRouter = router({
  /**
   * List all available providers with their status
   */
  list: publicProcedure.query(() => {
    return getAllProviderStatuses()
  }),

  /**
   * Get status for a single provider
   */
  getStatus: publicProcedure
    .input(z.object({ providerId: z.enum(["claude", "codex"]) }))
    .query(({ input }) => {
      const statuses = getAllProviderStatuses()
      return statuses.find((s) => s.id === input.providerId) || null
    }),

  /**
   * Check if a provider is available and authenticated
   */
  isReady: publicProcedure
    .input(z.object({ providerId: z.enum(["claude", "codex"]) }))
    .query(({ input }) => {
      const statuses = getAllProviderStatuses()
      const status = statuses.find((s) => s.id === input.providerId)

      if (!status) {
        return { ready: false, reason: "Provider not found" }
      }

      if (!status.available) {
        return {
          ready: false,
          reason: `${status.name} CLI not installed`,
          installHint:
            input.providerId === "claude"
              ? "Install via https://claude.ai/install.sh"
              : "Install via: npm install -g @openai/codex",
        }
      }

      if (!status.authStatus.authenticated) {
        return {
          ready: false,
          reason: status.authStatus.error || "Not authenticated",
          authHint:
            input.providerId === "claude"
              ? "Run: claude login"
              : "Set OPENAI_API_KEY or run: codex login",
        }
      }

      return { ready: true }
    }),

  /**
   * Get models for a specific provider
   */
  getModels: publicProcedure
    .input(z.object({ providerId: z.enum(["claude", "codex"]) }))
    .query(({ input }) => {
      const statuses = getAllProviderStatuses()
      const status = statuses.find((s) => s.id === input.providerId)
      return status?.models || []
    }),
})
