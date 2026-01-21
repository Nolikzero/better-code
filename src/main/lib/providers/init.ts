import { ClaudeProvider } from "./claude";
import { CodexProvider } from "./codex";
import { OpenCodeProvider } from "./opencode";
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

  // Register OpenCode provider
  const openCodeProvider = new OpenCodeProvider();
  providerRegistry.register(openCodeProvider);
  console.log("[providers] Registered OpenCode provider");

  // Initialize OpenCode (starts server if needed)
  // Do this asynchronously to not block startup
  openCodeProvider.initialize().catch((error) => {
    console.error("[providers] OpenCode initialization failed:", error);
    // Don't fail startup - provider will be marked as unavailable
  });

  // Set Claude as default
  providerRegistry.setDefault("claude");

  initialized = true;
  console.log("[providers] Initialization complete");
}

/**
 * Shutdown all providers (call during app quit)
 */
export async function shutdownProviders(): Promise<void> {
  console.log("[providers] Shutting down providers...");

  for (const provider of providerRegistry.getAll()) {
    if (provider.shutdown) {
      try {
        await provider.shutdown();
        console.log(`[providers] Shutdown ${provider.id} provider`);
      } catch (error) {
        console.error(`[providers] Failed to shutdown ${provider.id}:`, error);
      }
    }
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
