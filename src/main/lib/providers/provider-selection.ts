import type { ProviderId } from "./types";

type ProviderEnablement = {
  readonly id: ProviderId;
  readonly enabled: boolean;
};

export function selectEnabledProviderIds(
  providers: readonly ProviderEnablement[],
): ProviderId[] {
  return providers
    .filter((provider) => provider.enabled && provider.id.startsWith("api:"))
    .map((provider) => provider.id);
}
