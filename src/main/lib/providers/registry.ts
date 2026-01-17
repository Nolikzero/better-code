import type { AIProvider, ProviderId, ProviderStatus } from "./types"

/**
 * Registry for managing AI providers.
 * Singleton that holds all registered providers and provides lookup methods.
 */
export class ProviderRegistry {
  private providers = new Map<ProviderId, AIProvider>()
  private defaultProviderId: ProviderId = "claude"

  /**
   * Register a provider
   */
  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider)
  }

  /**
   * Unregister a provider
   */
  unregister(id: ProviderId): void {
    this.providers.delete(id)
  }

  /**
   * Get a provider by ID
   */
  get(id: ProviderId): AIProvider | undefined {
    return this.providers.get(id)
  }

  /**
   * Get all registered providers
   */
  getAll(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Get all provider IDs
   */
  getIds(): ProviderId[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Set the default provider
   */
  setDefault(id: ProviderId): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider ${id} not registered`)
    }
    this.defaultProviderId = id
  }

  /**
   * Get the default provider
   */
  getDefault(): AIProvider {
    const provider = this.providers.get(this.defaultProviderId)
    if (!provider) {
      // Fall back to first available provider
      const first = this.providers.values().next().value
      if (!first) {
        throw new Error("No providers registered")
      }
      return first
    }
    return provider
  }

  /**
   * Get default provider ID
   */
  getDefaultId(): ProviderId {
    return this.defaultProviderId
  }

  /**
   * Check if a provider is registered
   */
  has(id: ProviderId): boolean {
    return this.providers.has(id)
  }

  /**
   * Get status for all providers
   */
  async getAllStatus(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = []

    for (const provider of this.providers.values()) {
      const [available, authStatus] = await Promise.all([
        provider.isAvailable(),
        provider.getAuthStatus(),
      ])

      statuses.push({
        config: provider.config,
        available,
        authStatus,
      })
    }

    return statuses
  }

  /**
   * Get status for a single provider
   */
  async getStatus(id: ProviderId): Promise<ProviderStatus | null> {
    const provider = this.providers.get(id)
    if (!provider) return null

    const [available, authStatus] = await Promise.all([
      provider.isAvailable(),
      provider.getAuthStatus(),
    ])

    return {
      config: provider.config,
      available,
      authStatus,
    }
  }
}

// Global singleton instance
export const providerRegistry = new ProviderRegistry()
