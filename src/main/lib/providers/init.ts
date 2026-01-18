import { ClaudeProvider } from "./claude";
import { CodexProvider } from "./codex";
/**
 * Provider initialization
 *
 * Registers all available AI providers with the global registry.
 * Call this during app startup before any provider operations.
 */
import { providerRegistry } from "./registry";

let initialized = false;

/**
 * Initialize and register all AI providers
 */
export async function initializeProviders(): Promise<void> {
  if (initialized) {
    console.log("[providers] Already initialized, skipping");
    return;
  }

  console.log("[providers] Initializing providers...");

  // Register Claude provider
  const claudeProvider = new ClaudeProvider();
  providerRegistry.register(claudeProvider);
  console.log("[providers] Registered Claude provider");

  // Register Codex provider
  const codexProvider = new CodexProvider();
  providerRegistry.register(codexProvider);
  console.log("[providers] Registered Codex provider");

  // Set Claude as default
  providerRegistry.setDefault("claude");

  initialized = true;
  console.log("[providers] Initialization complete");
}

/**
 * Check if providers have been initialized
 */
export function isProvidersInitialized(): boolean {
  return initialized;
}

/**
 * Reset initialization state (for testing)
 */
export function resetProviderInitialization(): void {
  initialized = false;
}
