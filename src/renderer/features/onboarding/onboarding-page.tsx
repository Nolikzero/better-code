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
  defaultProviderIdAtom,
  onboardingCompletedAtom,
  PROVIDER_INFO,
  type ProviderId,
} from "../../lib/atoms";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import { normalizeProvidersList } from "../agents/hooks/use-providers";
import { getProviderIcon } from "../agents/ui/provider-icons";

const PROVIDER_ICON_BACKGROUNDS: Record<ProviderId, string> = {
  claude: "bg-[#D97757]",
  codex: "bg-[#10A37F]",
  opencode: "bg-[#6366F1]",
  grok: "bg-slate-900 dark:bg-slate-700",
};

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
        未安装
      </Badge>
    );
  }

  if (!authenticated) {
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
        <AlertCircle className="w-3 h-3 mr-1" />
        未登录
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-green-500 border-green-500/30">
      <Check className="w-3 h-3 mr-1" />
      就绪
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
          安装 Claude Code CLI 后即可开始：
        </p>
        <CopyableCommand command="curl -fsSL https://claude.ai/install.sh | sh" />
        <p className="text-xs text-muted-foreground">
          安装后请运行{" "}
          <code className="bg-muted px-1 rounded">claude login</code>{" "}
          完成身份验证。
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
        <p className="text-muted-foreground">打开终端</p>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
          2
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-muted-foreground">运行登录命令：</p>
          <CopyableCommand command="claude login" />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
          3
        </div>
        <p className="text-muted-foreground">在浏览器中完成身份验证</p>
      </div>
    </div>
  );
}

function CodexInstructions({ installed }: { installed: boolean }) {
  if (!installed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          安装 OpenAI Codex CLI 后即可开始：
        </p>
        <CopyableCommand command="npm install -g @openai/codex" />
        <p className="text-xs text-muted-foreground">
          安装后请运行{" "}
          <code className="bg-muted px-1 rounded">codex login</code>，或设置 API
          密钥。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">登录 Codex：</p>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">
          方式一：使用 OpenAI 登录
        </p>
        <CopyableCommand command="codex login" />
      </div>
      <div className="space-y-2 pt-2">
        <p className="text-xs text-muted-foreground font-medium">
          方式二：使用 API 密钥
        </p>
        <p className="text-xs text-muted-foreground">
          设置 <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code>{" "}
          环境变量
        </p>
      </div>
    </div>
  );
}

function OpenCodeInstructions({ installed }: { installed: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      {!installed && (
        <>
          <p className="text-muted-foreground">安装 OpenCode CLI：</p>
          <CopyableCommand command="npm install -g opencode-ai" />
        </>
      )}
      <p className="text-muted-foreground">登录并配置模型提供商：</p>
      <CopyableCommand command="opencode auth login" />
    </div>
  );
}

function GrokInstructions({ installed }: { installed: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      {!installed && (
        <p className="text-muted-foreground">
          请先安装 Grok Build CLI，再重新检查提供商状态。
        </p>
      )}
      <p className="text-muted-foreground">登录 Grok Build：</p>
      <CopyableCommand command="grok login" />
      <p className="text-xs text-muted-foreground">
        无法打开浏览器时，可运行{" "}
        <code className="bg-muted px-1 rounded">grok login --device-code</code>
        。
      </p>
    </div>
  );
}

const PROVIDER_INSTRUCTIONS: Record<
  ProviderId,
  (props: { installed: boolean }) => React.ReactNode
> = {
  claude: ClaudeInstructions,
  codex: CodexInstructions,
  opencode: OpenCodeInstructions,
  grok: GrokInstructions,
};

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
          {PROVIDER_INFO[providerId].name} 已可使用！
        </p>
      </div>
    );
  }

  const ProviderInstructions = PROVIDER_INSTRUCTIONS[providerId];
  return <ProviderInstructions installed={available} />;
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
  const providerList = normalizeProvidersList(providers);

  const selectedProviderData = providerList.find(
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
              选择 AI 提供商
            </h1>
            <p className="text-sm text-muted-foreground">
              选择用于编程的 AI 助手
            </p>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">可用提供商</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn("w-3 h-3", isRefetching && "animate-spin")}
              />
              刷新
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">正在检查提供商…</span>
            </div>
          ) : (
            <div className="space-y-2">
              {providers?.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProvider(provider.id)}
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
                        PROVIDER_ICON_BACKGROUNDS[provider.id],
                      )}
                    >
                      {getProviderIcon(provider.id, "w-5 h-5 text-white")}
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
            继续
          </button>

          <p className="text-xs text-muted-foreground text-center">
            你可以随时在设置中更改提供商。
          </p>
        </div>
      </div>
    </div>
  );
}
