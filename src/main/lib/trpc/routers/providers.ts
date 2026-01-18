import { z } from "zod";
import { providerRegistry } from "../../providers/registry";
import type { ProviderId } from "../../providers/types";
import { publicProcedure, router } from "../index";

/**
 * Providers router - exposes provider status through providerRegistry
 *
 * This router delegates to providerRegistry.getAllStatus() and getStatus()
 * instead of reimplementing auth checks and binary lookups.
 */

// Flatten ProviderStatus for renderer compatibility
// Renderer expects { id, name, description, ... } not { config: { id, name, ... }, ... }
interface FlatProviderStatus {
  id: ProviderId;
  name: string;
  description: string;
  available: boolean;
  authStatus: {
    authenticated: boolean;
    method?: "oauth" | "api-key";
    error?: string;
  };
  models: Array<{ id: string; name: string; displayName: string }>;
}

export const providersRouter = router({
  /**
   * List all available providers with their status
   */
  list: publicProcedure.query(async (): Promise<FlatProviderStatus[]> => {
    const statuses = await providerRegistry.getAllStatus();
    return statuses.map((status) => ({
      id: status.config.id,
      name: status.config.name,
      description: status.config.description,
      available: status.available,
      authStatus: status.authStatus,
      models: status.config.models,
    }));
  }),

  /**
   * Get status for a single provider
   */
  getStatus: publicProcedure
    .input(z.object({ providerId: z.enum(["claude", "codex"]) }))
    .query(async ({ input }): Promise<FlatProviderStatus | null> => {
      const status = await providerRegistry.getStatus(
        input.providerId as ProviderId,
      );
      if (!status) return null;

      return {
        id: status.config.id,
        name: status.config.name,
        description: status.config.description,
        available: status.available,
        authStatus: status.authStatus,
        models: status.config.models,
      };
    }),

  /**
   * Check if a provider is available and authenticated
   */
  isReady: publicProcedure
    .input(z.object({ providerId: z.enum(["claude", "codex"]) }))
    .query(async ({ input }) => {
      const status = await providerRegistry.getStatus(
        input.providerId as ProviderId,
      );

      if (!status) {
        return { ready: false, reason: "Provider not found" };
      }

      if (!status.available) {
        return {
          ready: false,
          reason: `${status.config.name} CLI not installed`,
          installHint:
            input.providerId === "claude"
              ? "Install via https://claude.ai/install.sh"
              : "Install via: npm install -g @openai/codex",
        };
      }

      if (!status.authStatus.authenticated) {
        return {
          ready: false,
          reason: status.authStatus.error || "Not authenticated",
          authHint:
            input.providerId === "claude"
              ? "Run: claude login"
              : "Set OPENAI_API_KEY or run: codex login",
        };
      }

      return { ready: true };
    }),

  /**
   * Get models for a specific provider
   */
  getModels: publicProcedure
    .input(z.object({ providerId: z.enum(["claude", "codex"]) }))
    .query(async ({ input }) => {
      const status = await providerRegistry.getStatus(
        input.providerId as ProviderId,
      );
      return status?.config.models || [];
    }),
});
