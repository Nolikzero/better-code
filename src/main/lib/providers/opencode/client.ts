import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import {
  createOpencodeClient as createOpencodeClientV2,
  type OpencodeClient as OpencodeClientV2,
} from "@opencode-ai/sdk/v2";
import type { ProviderModel } from "@shared/types";
import { getServerInstance } from "./server";

// Cache configuration
const MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Models cache
interface ModelsCache {
  models: ProviderModel[];
  connectedProviders: string[];
  fetchedAt: number;
}

let modelsCache: ModelsCache | null = null;

// Client instances (v1 for most operations, v2 for question handling)
let clientInstance: OpencodeClient | null = null;
let clientInstanceV2: OpencodeClientV2 | null = null;

/**
 * Get or create SDK client
 * Connects to local server at http://localhost:{port}
 */
export function getClient(): OpencodeClient {
  const server = getServerInstance();
  const baseUrl = server.getUrl();

  if (!clientInstance) {
    clientInstance = createOpencodeClient({
      baseUrl,
    });
  }

  return clientInstance;
}

/**
 * Get or create SDK v2 client (for question handling)
 */
export function getClientV2(): OpencodeClientV2 {
  const server = getServerInstance();
  const baseUrl = server.getUrl();

  if (!clientInstanceV2) {
    clientInstanceV2 = createOpencodeClientV2({
      baseUrl,
    });
  }

  return clientInstanceV2;
}

/**
 * Reset client instance (e.g., when server restarts)
 */
export function resetClient(): void {
  clientInstance = null;
  clientInstanceV2 = null;
}

/**
 * Check server health
 */
export async function checkHealth(): Promise<{
  healthy: boolean;
  version: string;
} | null> {
  try {
    const server = getServerInstance();
    const response = await fetch(`${server.getUrl()}/global/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("[opencode-client] Health check failed:", error);
    return null;
  }
}

/**
 * Fetch available providers and models from running server
 * Returns cached data if within TTL
 */
export async function fetchProviders(forceRefresh = false): Promise<{
  models: ProviderModel[];
  connectedProviders: string[];
}> {
  const now = Date.now();

  // Return cached if valid and not forcing refresh
  if (
    !forceRefresh &&
    modelsCache &&
    now - modelsCache.fetchedAt < MODELS_CACHE_TTL
  ) {
    return {
      models: modelsCache.models,
      connectedProviders: modelsCache.connectedProviders,
    };
  }

  const client = getClient();

  try {
    // Fetch providers from API
    const response = await client.provider.list();
    const providersData = response.data;

    if (!providersData) {
      throw new Error("No provider data returned");
    }

    // Build flattened models list
    const models: ProviderModel[] = [];
    const connectedProviders: string[] = providersData.connected || [];

    // providersData.all is an array of providers with models as a Record
    for (const provider of providersData.all || []) {
      const providerModels = provider.models || {};
      // models is a Record<string, Model>
      for (const [modelKey, model] of Object.entries(providerModels)) {
        models.push({
          // Use "providerID/modelID" format for unique identification
          id: `${provider.id}/${model.id || modelKey}`,
          name: model.id || modelKey,
          displayName: model.name || model.id || modelKey,
        });
      }
    }

    // Update cache
    modelsCache = {
      models,
      connectedProviders,
      fetchedAt: now,
    };

    console.log(
      `[opencode-client] Fetched ${models.length} models from ${providersData.all?.length || 0} providers`,
    );

    return { models, connectedProviders };
  } catch (error) {
    console.error("[opencode-client] Failed to fetch providers:", error);

    // Return cached data if available, even if stale
    if (modelsCache) {
      console.log("[opencode-client] Returning stale cached providers");
      return {
        models: modelsCache.models,
        connectedProviders: modelsCache.connectedProviders,
      };
    }

    // Return empty response
    return { models: [], connectedProviders: [] };
  }
}

/**
 * Fetch all available models (flattened from all providers)
 * Returns in format compatible with ProviderModel
 */
export async function fetchModels(
  forceRefresh = false,
): Promise<ProviderModel[]> {
  const { models } = await fetchProviders(forceRefresh);
  return models;
}

/**
 * Get cached models without fetching
 */
export function getCachedModels(): ProviderModel[] {
  return modelsCache?.models || [];
}

/**
 * Invalidate models cache (force refresh on next fetch)
 */
export function invalidateModelsCache(): void {
  modelsCache = null;
}

/**
 * Get authentication status for all providers
 * Returns map of provider ID to connected status
 */
export async function getAuthStatus(): Promise<Record<string, boolean>> {
  try {
    const { connectedProviders } = await fetchProviders();
    const status: Record<string, boolean> = {};

    for (const providerId of connectedProviders) {
      status[providerId] = true;
    }

    return status;
  } catch (error) {
    console.error("[opencode-client] Failed to get auth status:", error);
    return {};
  }
}

/**
 * Set authentication for a specific provider
 */
export async function setProviderAuth(
  providerId: string,
  auth: { type: "api"; key: string },
): Promise<boolean> {
  try {
    const client = getClient();
    const response = await client.auth.set({
      path: { id: providerId },
      body: auth,
    });
    return response.data === true;
  } catch (error) {
    console.error(
      `[opencode-client] Failed to set auth for ${providerId}:`,
      error,
    );
    return false;
  }
}

/**
 * Create a new session
 */
export async function createSession(
  title?: string,
  directory?: string,
): Promise<{ id: string } | null> {
  try {
    const client = getClient();
    const response = await client.session.create({
      body: { title },
      query: { directory },
    });
    if (response.data) {
      return { id: response.data.id };
    }
    return null;
  } catch (error) {
    console.error("[opencode-client] Failed to create session:", error);
    return null;
  }
}

/**
 * Get an existing session
 */
export async function getSession(
  sessionId: string,
  directory?: string,
): Promise<{ id: string } | null> {
  try {
    const client = getClient();
    const response = await client.session.get({
      path: { id: sessionId },
      query: { directory },
    });
    if (response.data) {
      return { id: response.data.id };
    }
    return null;
  } catch (error) {
    console.error(
      `[opencode-client] Failed to get session ${sessionId}:`,
      error,
    );
    return null;
  }
}

/**
 * Abort a running session
 */
export async function abortSession(sessionId: string): Promise<boolean> {
  try {
    const client = getClient();
    const response = await client.session.abort({
      path: { id: sessionId },
    });
    return response.data === true;
  } catch (error) {
    console.error(
      `[opencode-client] Failed to abort session ${sessionId}:`,
      error,
    );
    return false;
  }
}

/**
 * Reply to a question request from the AI assistant
 * @param requestId - The question request ID
 * @param answers - Array of selected labels for each question
 */
export async function replyToQuestion(
  requestId: string,
  answers: string[][],
  directory?: string,
): Promise<boolean> {
  try {
    const client = getClientV2();
    const response = await client.question.reply({
      requestID: requestId,
      answers,
      directory,
    });
    return response.data === true;
  } catch (error) {
    console.error(
      `[opencode-client] Failed to reply to question ${requestId}:`,
      error,
    );
    return false;
  }
}

/**
 * Reject a question request from the AI assistant
 * @param requestId - The question request ID
 * @param directory - The working directory for the session
 */
export async function rejectQuestion(
  requestId: string,
  directory?: string,
): Promise<boolean> {
  try {
    const client = getClientV2();
    const response = await client.question.reject({
      requestID: requestId,
      directory,
    });
    return response.data === true;
  } catch (error) {
    console.error(
      `[opencode-client] Failed to reject question ${requestId}:`,
      error,
    );
    return false;
  }
}

/**
 * Provider with models and connection status for UI
 */
export interface OpenCodeProviderWithModels {
  id: string;
  name: string;
  connected: boolean;
  models: Array<{ id: string; name: string; displayName: string }>;
}

/**
 * Fetch providers with full structure (not flattened)
 * Returns providers grouped with their models and connection status
 * Used by OpenCode model selector UI
 */
export async function fetchProvidersWithDetails(
  _forceRefresh = false,
): Promise<{
  providers: OpenCodeProviderWithModels[];
}> {
  const client = getClient();

  try {
    // Fetch providers from API
    const response = await client.provider.list();
    const providersData = response.data;

    if (!providersData) {
      throw new Error("No provider data returned");
    }

    const connectedSet = new Set(providersData.connected || []);
    const providers: OpenCodeProviderWithModels[] = [];

    // Build structured provider list with models
    for (const provider of providersData.all || []) {
      const providerModels = provider.models || {};
      const models: Array<{ id: string; name: string; displayName: string }> =
        [];

      // Convert models Record to array
      for (const [modelKey, model] of Object.entries(providerModels)) {
        models.push({
          id: model.id || modelKey,
          name: model.id || modelKey,
          displayName: model.name || model.id || modelKey,
        });
      }

      providers.push({
        id: provider.id,
        name: provider.name || provider.id,
        connected: connectedSet.has(provider.id),
        models,
      });
    }

    // Sort: connected providers first, then alphabetically
    providers.sort((a, b) => {
      if (a.connected !== b.connected) {
        return a.connected ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    console.log(
      `[opencode-client] Fetched ${providers.length} providers with details`,
    );

    return { providers };
  } catch (error) {
    console.error(
      "[opencode-client] Failed to fetch providers with details:",
      error,
    );
    return { providers: [] };
  }
}

/**
 * Summarize (compact) a session to reduce token usage
 */
export async function summarizeSession(
  sessionId: string,
  directory?: string,
): Promise<boolean> {
  try {
    const client = getClient();
    await client.session.summarize({
      path: { id: sessionId },
      query: { directory },
    });
    return true;
  } catch (error) {
    console.error(
      `[opencode-client] Failed to summarize session ${sessionId}:`,
      error,
    );
    return false;
  }
}

/**
 * Parse model string into providerID and modelID
 * Handles formats: "providerID/modelID" or just "modelID"
 */
export function parseModelId(
  model: string,
): { providerID: string; modelID: string } | undefined {
  if (model.includes("/")) {
    const [providerID, modelID] = model.split("/", 2);
    return { providerID, modelID };
  }

  // Try to find provider from cached models
  const cachedModel = modelsCache?.models.find(
    (m) => m.name === model || m.id.endsWith(`/${model}`),
  );

  if (cachedModel) {
    const parts = cachedModel.id.split("/");
    if (parts.length === 2) {
      return { providerID: parts[0], modelID: parts[1] };
    }
  }

  // Default to anthropic if we can't determine provider
  return { providerID: "anthropic", modelID: model };
}
