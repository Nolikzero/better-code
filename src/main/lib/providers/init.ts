import { ClaudeProvider } from "./claude";
import { CodexProvider } from "./codex";
import { OpenCodeProvider } from "./opencode";
/**
 * Provider initialization
 *
 * Providers are only loaded when enabled by the user (via onboarding/settings).
 */
import { providerRegistry } from "./registry";
import type { AIProvider, ProviderId } from "./types";

const providerFactories: Record<ProviderId, () => AIProvider> = {
  claude: () => new ClaudeProvider(),
  codex: () => new CodexProvider(),
  opencode: () => new OpenCodeProvider(),
};

let initialized = false;
let enabledProviderIds: ProviderId[] = [];

function normalizeProviderIds(ids: ProviderId[]): ProviderId[] {
  return Array.from(new Set(ids));
}

async function registerProvider(id: ProviderId): Promise<void> {
  if (providerRegistry.has(id)) return;

  const providerFactory = providerFactories[id];
  const provider = providerFactory();
  providerRegistry.register(provider);
  console.log(`[providers] Registered ${provider.id} provider`);

  if (provider.initialize) {
    provider.initialize().catch((error) => {
      console.error(`[providers] ${provider.id} initialization failed:`, error);
    });
  }
}

async function unregisterProvider(id: ProviderId): Promise<void> {
  const provider = providerRegistry.get(id);
  if (!provider) return;

  if (provider.shutdown) {
    try {
      await provider.shutdown();
      console.log(`[providers] Shutdown ${provider.id} provider`);
    } catch (error) {
      console.error(`[providers] Failed to shutdown ${provider.id}:`, error);
    }
  }

  providerRegistry.unregister(id);
  console.log(`[providers] Unregistered ${id} provider`);
}

/**
 * Enable a specific set of providers (registers + initializes as needed).
 */
export async function setEnabledProviders(
  providerIds: ProviderId[],
): Promise<void> {
  const desiredIds = normalizeProviderIds(providerIds);
  const desiredSet = new Set(desiredIds);
  const currentIds = providerRegistry.getIds();

  // Remove providers no longer enabled
  for (const id of currentIds) {
    if (!desiredSet.has(id)) {
      await unregisterProvider(id);
    }
  }

  // Register newly enabled providers
  for (const id of desiredIds) {
    await registerProvider(id);
  }

  if (desiredIds.length > 0 && providerRegistry.has(desiredIds[0])) {
    providerRegistry.setDefault(desiredIds[0]);
  }

  enabledProviderIds = desiredIds;
  initialized = true;
  console.log(
    `[providers] Enabled providers: ${enabledProviderIds.join(", ") || "none"}`,
  );
}

/**
 * Initialize providers with a list (legacy entry point).
 */
export async function initializeProviders(
  providerIds: ProviderId[] = [],
): Promise<void> {
  if (initialized && providerIds.length === 0) {
    console.log("[providers] Already initialized, skipping");
    return;
  }

  if (providerIds.length === 0) {
    console.log("[providers] Initialization skipped (no providers enabled)");
    initialized = true;
    return;
  }

  console.log("[providers] Initializing providers...");
  await setEnabledProviders(providerIds);
  console.log("[providers] Initialization complete");
}

/**
 * Shutdown all providers (call during app quit)
 */
export async function shutdownProviders(): Promise<void> {
  console.log("[providers] Shutting down providers...");

  for (const provider of providerRegistry.getAll()) {
    await unregisterProvider(provider.id);
  }

  console.log("[providers] All providers shutdown complete");
}

/**
 * Check if providers have been initialized
 */
function _isProvidersInitialized(): boolean {
  return initialized;
}

/**
 * Reset initialization state (for testing)
 */
function _resetProviderInitialization(): void {
  initialized = false;
}

/**
 * Get the currently enabled providers (in-memory).
 */
export function getEnabledProviders(): ProviderId[] {
  return [...enabledProviderIds];
}
