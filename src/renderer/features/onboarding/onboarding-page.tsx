"use client";

import { useSetAtom } from "jotai";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Logo } from "../../components/ui/logo";
import {
  PROVIDER_INFO,
  type ProviderId,
  defaultProviderIdAtom,
  onboardingCompletedAtom,
} from "../../lib/atoms";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import { getProviderIcon } from "../agents/ui/provider-icons";

function ProviderStatusBadge({
  available,
  authenticated,
}: {
  available: boolean;
  authenticated: boolean;
}) {
  if (!available) {
    return (
      <Badge variant="outline" className="text-orange-500 border-orange-500/30">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Installed
      </Badge>
    );
  }

  if (!authenticated) {
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not Signed In
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-green-500 border-green-500/30">
      <Check className="w-3 h-3 mr-1" />
      Ready
    </Badge>
  );
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 w-full px-3 py-2 bg-muted rounded-lg font-mono text-sm hover:bg-muted/80 transition-colors"
    >
      <Terminal className="w-4 h-4 text-muted-foreground" />
      <span className="flex-1 text-left">{command}</span>
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}

function ClaudeInstructions({ installed }: { installed: boolean }) {
  if (!installed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Install Claude Code CLI to get started:
        </p>
        <CopyableCommand command="curl -fsSL https://claude.ai/install.sh | sh" />
        <p className="text-xs text-muted-foreground">
          After installation, run{" "}
          <code className="bg-muted px-1 rounded">claude login</code> to
          authenticate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
          1
        </div>
        <p className="text-muted-foreground">Open Terminal</p>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
          2
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-muted-foreground">Run the login command:</p>
          <CopyableCommand command="claude login" />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
          3
        </div>
        <p className="text-muted-foreground">
          Complete authentication in your browser
        </p>
      </div>
    </div>
  );
}

function CodexInstructions({ installed }: { installed: boolean }) {
  if (!installed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Install OpenAI Codex CLI to get started:
        </p>
        <CopyableCommand command="npm install -g @openai/codex" />
        <p className="text-xs text-muted-foreground">
          After installation, run{" "}
          <code className="bg-muted px-1 rounded">codex login</code> or set your
          API key.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Sign in to Codex:</p>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">
          Option 1: Login with OpenAI
        </p>
        <CopyableCommand command="codex login" />
      </div>
      <div className="space-y-2 pt-2">
        <p className="text-xs text-muted-foreground font-medium">
          Option 2: Use API Key
        </p>
        <p className="text-xs text-muted-foreground">
          Set the <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code>{" "}
          environment variable
        </p>
      </div>
    </div>
  );
}

function InstructionsPanel({
  providerId,
  available,
  authenticated,
}: {
  providerId: ProviderId;
  available: boolean;
  authenticated: boolean;
}) {
  if (available && authenticated) {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
          <Check className="w-4 h-4" />
          {PROVIDER_INFO[providerId].name} is ready to use!
        </p>
      </div>
    );
  }

  if (providerId === "claude") {
    return <ClaudeInstructions installed={available} />;
  }

  if (providerId === "codex") {
    return <CodexInstructions installed={available} />;
  }

  return null;
}

export function OnboardingPage() {
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderId>("claude");
  const setOnboardingCompleted = useSetAtom(onboardingCompletedAtom);
  const setDefaultProvider = useSetAtom(defaultProviderIdAtom);

  const {
    data: providers,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.providers.list.useQuery();

  const selectedProviderData = providers?.find(
    (p) => p.id === selectedProvider,
  );

  const handleContinue = () => {
    setDefaultProvider(selectedProvider);
    setOnboardingCompleted(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background select-none">
      {/* Draggable title bar area */}
      <div
        className="fixed top-0 left-0 right-0 h-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="w-full max-w-[480px] space-y-6 px-4">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center p-2 mx-auto w-max rounded-full border border-border">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Logo className="w-5 h-5" fill="white" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold tracking-tight">
              Choose Your AI Provider
            </h1>
            <p className="text-sm text-muted-foreground">
              Select which AI assistant to use for coding
            </p>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Available Providers</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn("w-3 h-3", isRefetching && "animate-spin")}
              />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Checking providers...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {providers?.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProvider(provider.id as ProviderId)}
                  className={cn(
                    "w-full p-4 rounded-lg border transition-all text-left",
                    selectedProvider === provider.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        provider.id === "claude"
                          ? "bg-[#D97757]"
                          : "bg-[#10A37F]",
                      )}
                    >
                      {getProviderIcon(
                        provider.id as ProviderId,
                        "w-5 h-5 text-white",
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">
                          {provider.name}
                        </span>
                        <ProviderStatusBadge
                          available={provider.available}
                          authenticated={provider.authStatus.authenticated}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {provider.description}
                      </p>
                    </div>

                    {selectedProvider === provider.id && (
                      <Check className="w-5 h-5 text-primary shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Instructions Panel */}
        {selectedProviderData && (
          <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
            <InstructionsPanel
              providerId={selectedProvider}
              available={selectedProviderData.available}
              authenticated={selectedProviderData.authStatus.authenticated}
            />
          </div>
        )}

        {/* Continue Button */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full h-8 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)] flex items-center justify-center"
          >
            Continue
          </button>

          <p className="text-xs text-muted-foreground text-center">
            You can change your provider anytime in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
