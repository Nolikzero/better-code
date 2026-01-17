import { useAtom } from "jotai"
import { useState, useEffect } from "react"
import { Check, AlertCircle, Loader2, ShieldAlert } from "lucide-react"
import {
  defaultProviderIdAtom,
  PROVIDER_INFO,
  PROVIDER_MODELS,
  lastSelectedModelByProviderAtom,
  codexSandboxModeAtom,
  codexApprovalPolicyAtom,
  codexReasoningEffortAtom,
  SANDBOX_MODES,
  APPROVAL_POLICIES,
  REASONING_EFFORTS,
  type ProviderId,
  type SandboxMode,
  type ApprovalPolicy,
  type ReasoningEffort,
} from "../../../lib/atoms"
import { trpc } from "../../../lib/trpc"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../ui/select"
import { Badge } from "../../ui/badge"

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768)
    }

    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  return isNarrow
}

// Provider status indicator
function ProviderStatus({
  available,
  authenticated,
}: {
  available: boolean
  authenticated: boolean
}) {
  if (!available) {
    return (
      <Badge variant="outline" className="text-orange-500 border-orange-500/30">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Installed
      </Badge>
    )
  }

  if (!authenticated) {
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Signed In
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-green-500 border-green-500/30">
      <Check className="w-3 h-3 mr-1" />
      Ready
    </Badge>
  )
}

export function AgentsProviderTab() {
  const [defaultProvider, setDefaultProvider] = useAtom(defaultProviderIdAtom)
  const [modelsByProvider, setModelsByProvider] = useAtom(
    lastSelectedModelByProviderAtom
  )
  const [sandboxMode, setSandboxMode] = useAtom(codexSandboxModeAtom)
  const [approvalPolicy, setApprovalPolicy] = useAtom(codexApprovalPolicyAtom)
  const [reasoningEffort, setReasoningEffort] = useAtom(codexReasoningEffortAtom)
  const isNarrowScreen = useIsNarrowScreen()

  // Fetch provider status from backend
  const { data: providers, isLoading } = trpc.providers.list.useQuery()

  const handleProviderChange = (value: ProviderId) => {
    setDefaultProvider(value)
  }

  const handleModelChange = (providerId: ProviderId, modelId: string) => {
    setModelsByProvider({
      ...modelsByProvider,
      [providerId]: modelId,
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header - hidden on narrow screens since it's in the navigation bar */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">
            AI Provider
          </h3>
          <p className="text-xs text-muted-foreground">
            Choose your default AI assistant and model
          </p>
        </div>
      )}

      {/* Default Provider Section */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-foreground">
                Default Provider
              </span>
              <span className="text-xs text-muted-foreground">
                Used for new chats (can be changed per-chat)
              </span>
            </div>

            <Select
              value={defaultProvider}
              onValueChange={(value: ProviderId) => handleProviderChange(value)}
            >
              <SelectTrigger className="w-[160px]">
                <span className="text-xs">
                  {PROVIDER_INFO[defaultProvider]?.name || defaultProvider}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_INFO) as ProviderId[]).map(
                  (providerId) => (
                    <SelectItem key={providerId} value={providerId}>
                      {PROVIDER_INFO[providerId].name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Provider Status Section */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-4 space-y-4">
          <span className="text-sm font-medium text-foreground">
            Available Providers
          </span>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Checking providers...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {providers?.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {provider.name}
                      </span>
                      {provider.id === defaultProvider && (
                        <Badge variant="secondary" className="text-[10px]">
                          Default
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {provider.description}
                    </span>
                  </div>
                  <ProviderStatus
                    available={provider.available}
                    authenticated={provider.authStatus.authenticated}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Default Models Section */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex flex-col space-y-1">
            <span className="text-sm font-medium text-foreground">
              Default Models
            </span>
            <span className="text-xs text-muted-foreground">
              Preferred model for each provider
            </span>
          </div>

          <div className="space-y-3">
            {(Object.keys(PROVIDER_MODELS) as ProviderId[]).map((providerId) => (
              <div
                key={providerId}
                className="flex items-center justify-between"
              >
                <span className="text-sm text-muted-foreground">
                  {PROVIDER_INFO[providerId].name}
                </span>

                <Select
                  value={modelsByProvider[providerId]}
                  onValueChange={(value) => handleModelChange(providerId, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <span className="text-xs">
                      {PROVIDER_MODELS[providerId].find(
                        (m) => m.id === modelsByProvider[providerId]
                      )?.displayName || modelsByProvider[providerId]}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_MODELS[providerId].map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Codex Settings Section - Only show when Codex is selected or available */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                OpenAI Codex Settings
              </span>
              {defaultProvider !== "codex" && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Not Active
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Configure execution behavior for Codex provider
            </span>
          </div>

          <div className="space-y-3">
            {/* Sandbox Mode */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm text-foreground">Sandbox Mode</span>
                <span className="text-xs text-muted-foreground truncate">
                  {SANDBOX_MODES.find(m => m.id === sandboxMode)?.description}
                </span>
              </div>
              <Select
                value={sandboxMode}
                onValueChange={(value: SandboxMode) => setSandboxMode(value)}
              >
                <SelectTrigger className="w-[160px] flex-shrink-0">
                  <span className="text-xs">
                    {SANDBOX_MODES.find(m => m.id === sandboxMode)?.name}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {SANDBOX_MODES.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      <div className="flex items-center gap-2">
                        {mode.id === "danger-full-access" && (
                          <ShieldAlert className="w-3 h-3 text-red-500" />
                        )}
                        {mode.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warning for Full Access */}
            {sandboxMode === "danger-full-access" && (
              <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-500">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Full access mode allows unrestricted system access. Only use in isolated environments.
                </span>
              </div>
            )}

            {/* Approval Policy */}
            <div className="flex items-start justify-between gap-4 opacity-50">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm text-foreground">Approval Policy</span>
                <span className="text-xs text-muted-foreground truncate">
                  Uses automatic execution in non-interactive mode
                </span>
              </div>
              <Select
                value={approvalPolicy}
                onValueChange={(value: ApprovalPolicy) => setApprovalPolicy(value)}
                disabled
              >
                <SelectTrigger className="w-[160px] flex-shrink-0" disabled>
                  <span className="text-xs">Auto</span>
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_POLICIES.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reasoning Effort */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm text-foreground">Reasoning Effort</span>
                <span className="text-xs text-muted-foreground truncate">
                  {REASONING_EFFORTS.find(e => e.id === reasoningEffort)?.description}
                </span>
              </div>
              <Select
                value={reasoningEffort}
                onValueChange={(value: ReasoningEffort) => setReasoningEffort(value)}
              >
                <SelectTrigger className="w-[160px] flex-shrink-0">
                  <span className="text-xs">
                    {REASONING_EFFORTS.find(e => e.id === reasoningEffort)?.name}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {REASONING_EFFORTS.map((effort) => (
                    <SelectItem key={effort.id} value={effort.id}>
                      {effort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Install Help Section */}
      <div className="bg-muted/30 rounded-lg border border-border p-4">
        <span className="text-xs text-muted-foreground">
          <strong className="text-foreground">Need to install a provider?</strong>
          <br />
          <span className="mt-1 block">
            Claude Code:{" "}
            <code className="bg-muted px-1 rounded">
              curl -fsSL https://claude.ai/install.sh | sh
            </code>
          </span>
          <span className="block">
            OpenAI Codex:{" "}
            <code className="bg-muted px-1 rounded">
              npm install -g @openai/codex
            </code>
          </span>
        </span>
      </div>
    </div>
  )
}
