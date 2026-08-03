import { PROVIDER_INFO } from "@shared/constants";
import type { ProviderId } from "@shared/types";

type ProviderDisplaySource = {
  readonly id: ProviderId;
  readonly name: string;
};

export function resolveProviderDisplayName(
  providerId: ProviderId,
  providers: readonly ProviderDisplaySource[],
): string {
  const configuredProvider = providers.find(
    (provider) => provider.id === providerId,
  );
  return (
    configuredProvider?.name ?? PROVIDER_INFO[providerId]?.name ?? "未知服务商"
  );
}
