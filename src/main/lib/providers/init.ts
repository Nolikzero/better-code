/**
 * API provider initialization.
 *
 * Provider definitions are stored in SQLite and instantiated only when enabled.
 * Legacy CLI provider implementations remain in the source tree for migration
 * compatibility but are not registered in the application runtime.
 */
import { ApiProvider } from "./api/provider";
import { getApiProviderRecord, setApiProvidersEnabled } from "./api/store";
import { providerRegistry } from "./registry";
import type { ProviderId } from "./types";

let initialized = false;
let enabledProviderIds: ProviderId[] = [];

function normalizeProviderIds(ids: readonly ProviderId[]): ProviderId[] {
  return Array.from(new Set(ids.filter((id) => id.startsWith("api:"))));
}

async function registerProvider(id: ProviderId): Promise<boolean> {
  const record = getApiProviderRecord(id);
  if (!record) return false;

  const existing = providerRegistry.get(id);
  if (existing?.shutdown) await existing.shutdown();
  if (existing) providerRegistry.unregister(id);

  const provider = new ApiProvider(record);
  providerRegistry.register(provider);
  console.log(`[providers] Registered API provider ${provider.id}`);
  return true;
}

async function unregisterProvider(id: ProviderId): Promise<void> {
  const provider = providerRegistry.get(id);
  if (!provider) return;
  if (provider.shutdown) await provider.shutdown();
  providerRegistry.unregister(id);
  console.log(`[providers] Unregistered API provider ${id}`);
}

export async function setEnabledProviders(
  providerIds: readonly ProviderId[],
): Promise<void> {
  const desiredIds = normalizeProviderIds(providerIds);
  const desiredSet = new Set(desiredIds);

  for (const id of providerRegistry.getIds()) {
    if (!desiredSet.has(id)) await unregisterProvider(id);
  }

  const registeredIds: ProviderId[] = [];
  for (const id of desiredIds) {
    if (await registerProvider(id)) registeredIds.push(id);
  }

  if (registeredIds[0] && providerRegistry.has(registeredIds[0])) {
    providerRegistry.setDefault(registeredIds[0]);
  }

  setApiProvidersEnabled(registeredIds);
  enabledProviderIds = registeredIds;
  initialized = true;
  console.log(
    `[providers] Enabled API providers: ${enabledProviderIds.join(", ") || "none"}`,
  );
}

export async function reloadProvider(providerId: ProviderId): Promise<void> {
  if (!enabledProviderIds.includes(providerId)) return;
  await registerProvider(providerId);
}

export async function removeProvider(providerId: ProviderId): Promise<void> {
  await unregisterProvider(providerId);
  enabledProviderIds = enabledProviderIds.filter((id) => id !== providerId);
}

export async function initializeProviders(
  providerIds: readonly ProviderId[] = [],
): Promise<void> {
  if (initialized && providerIds.length === 0) return;
  await setEnabledProviders(providerIds);
}

export async function shutdownProviders(): Promise<void> {
  for (const provider of providerRegistry.getAll()) {
    await unregisterProvider(provider.id);
  }
}

export function getEnabledProviders(): ProviderId[] {
  return [...enabledProviderIds];
}
