"use client";

import { useAtom, useSetAtom } from "jotai";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Logo } from "../../components/ui/logo";
import {
  onboardingCompletedAtom,
  PROVIDER_INFO,
  type ProviderId,
} from "../../lib/atoms";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import { selectedProjectAtom } from "../agents/atoms";
import { normalizeProvidersList } from "../agents/hooks/use-providers";
import { getProviderIcon } from "../agents/ui/provider-icons";

// ============================================
// TYPES
// ============================================

type Step = "welcome" | "provider" | "repository" | "ready";

const PROVIDER_ICON_STYLES: Record<
  ProviderId,
  { readonly background: string; readonly foreground: string }
> = {
  claude: {
    background: "bg-[#D97757]/10",
    foreground: "text-[#D97757]",
  },
  codex: {
    background: "bg-[#10A37F]/10",
    foreground: "text-[#10A37F]",
  },
  opencode: {
    background: "bg-[#6366F1]/10",
    foreground: "text-[#6366F1]",
  },
  grok: {
    background: "bg-slate-100 dark:bg-slate-800",
    foreground: "text-slate-900 dark:text-slate-100",
  },
};

// ============================================
// STEP PROGRESS
// ============================================

function StepProgress({
  steps,
  currentStep,
}: {
  steps: Step[];
  currentStep: Step;
}) {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-1.5">
      {steps.map((step, i) => (
        <motion.div
          key={step}
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-colors duration-200",
            i <= currentIndex ? "bg-primary" : "bg-border",
          )}
          animate={i === currentIndex ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  );
}

// ============================================
// STATUS BADGE
// ============================================

function ProviderStatusBadge({
  enabled,
  available,
  authenticated,
}: {
  enabled: boolean;
  available?: boolean;
  authenticated?: boolean;
}) {
  if (!enabled) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] py-0 px-1.5 font-normal gap-1 text-muted-foreground border-border"
      >
        可选
      </Badge>
    );
  }

  if (available === undefined || authenticated === undefined) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] py-0 px-1.5 font-normal gap-1 text-muted-foreground border-border"
      >
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        正在检查
      </Badge>
    );
  }

  if (!available) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] py-0 px-1.5 font-normal gap-1 text-muted-foreground border-border"
      >
        <AlertCircle className="w-2.5 h-2.5" />
        安装
      </Badge>
    );
  }

  if (!authenticated) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] py-0 px-1.5 font-normal gap-1 text-muted-foreground border-border"
      >
        <AlertCircle className="w-2.5 h-2.5" />
        需要设置
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="text-[10px] py-0 px-1.5 font-normal gap-1 text-primary border-primary/20 bg-primary/5"
    >
      <Check className="w-2.5 h-2.5" />
      就绪
    </Badge>
  );
}

// ============================================
// COPYABLE COMMAND
// ============================================

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      type="button"
      onClick={handleCopy}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 rounded-md",
        "bg-background border border-border",
        "font-mono text-xs",
        "hover:bg-muted/50 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
      )}
    >
      <Terminal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-left truncate">{command}</span>
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <Check className="w-3.5 h-3.5 text-primary" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================
// SETUP INSTRUCTIONS
// ============================================

function ClaudeInstructions({ installed }: { installed: boolean }) {
  if (!installed) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            1
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">
              安装 Claude Code CLI：
            </p>
            <CopyableCommand command="curl -fsSL https://claude.ai/install.sh | sh" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            2
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">然后完成身份验证：</p>
            <CopyableCommand command="claude login" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
          1
        </div>
        <p className="text-sm text-muted-foreground">打开终端</p>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
          2
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">运行登录命令：</p>
          <CopyableCommand command="claude login" />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
          3
        </div>
        <p className="text-sm text-muted-foreground">在浏览器中完成身份验证</p>
      </div>
    </div>
  );
}

function CodexInstructions({ installed }: { installed: boolean }) {
  if (!installed) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            1
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">安装 Codex CLI：</p>
            <CopyableCommand command="npm install -g @openai/codex" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            2
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">然后完成身份验证：</p>
            <CopyableCommand command="codex login" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        方式一：使用 OpenAI 登录
      </p>
      <CopyableCommand command="codex login" />
      <div className="pt-2">
        <p className="text-xs font-medium text-muted-foreground">
          方式二：使用 API 密钥
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          设置 <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code>{" "}
          环境变量
        </p>
      </div>
    </div>
  );
}

function OpenCodeInstructions({ installed }: { installed: boolean }) {
  return (
    <div className="space-y-3">
      {!installed && (
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            1
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">安装 OpenCode CLI：</p>
            <CopyableCommand command="npm install -g opencode-ai" />
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
          {installed ? "1" : "2"}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            登录并配置模型提供商：
          </p>
          <CopyableCommand command="opencode auth login" />
        </div>
      </div>
    </div>
  );
}

function GrokInstructions({ installed }: { installed: boolean }) {
  return (
    <div className="space-y-3">
      {!installed && (
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            1
          </div>
          <p className="text-sm text-muted-foreground">
            请先安装 Grok Build CLI，再重新检查提供商状态。
          </p>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
          {installed ? "1" : "2"}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">登录 Grok Build：</p>
          <CopyableCommand command="grok login" />
          <p className="text-xs text-muted-foreground">
            无法打开浏览器时，可运行{" "}
            <code className="bg-muted px-1 rounded">
              grok login --device-code
            </code>
            。
          </p>
        </div>
      </div>
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

function SetupInstructions({
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
      <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/10">
        <Check className="w-4 h-4 text-primary shrink-0" />
        <p className="text-sm text-primary">
          {PROVIDER_INFO[providerId].name} 已可使用
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="p-4 bg-muted/40 rounded-md border border-border">
        {(() => {
          const ProviderInstructions = PROVIDER_INSTRUCTIONS[providerId];
          return <ProviderInstructions installed={available} />;
        })()}
      </div>
    </motion.div>
  );
}

// ============================================
// PROVIDER CARD
// ============================================

function ProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: {
    id: ProviderId;
    name: string;
    description: string;
    available?: boolean;
    authStatus?: { authenticated?: boolean };
  };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full p-4 rounded-md border transition-all duration-150",
        "text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/[0.03] shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
            PROVIDER_ICON_STYLES[provider.id].background,
          )}
        >
          {getProviderIcon(
            provider.id,
            cn("w-5 h-5", PROVIDER_ICON_STYLES[provider.id].foreground),
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">{provider.name}</span>
            <ProviderStatusBadge
              enabled={selected}
              available={provider.available}
              authenticated={provider.authStatus?.authenticated}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {provider.description}
          </p>
        </div>

        <div className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center">
          {selected && <Check className="w-3.5 h-3.5 text-primary" />}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================
// STEP: WELCOME
// ============================================

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 text-center"
    >
      <div className="space-y-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center justify-center p-2 mx-auto w-max rounded-full border border-border"
        >
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
            <Logo className="w-7 h-7" fill="white" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="space-y-2"
        >
          <h1 className="text-xl font-semibold tracking-tight">
            欢迎使用 SamBetterCode
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            你的 AI 编程助手。只需几步即可完成设置。
          </p>
        </motion.div>
      </div>

      <motion.button
        type="button"
        onClick={onNext}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        whileTap={{ scale: 0.97 }}
        className="w-full h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-colors hover:bg-primary/90 flex items-center justify-center gap-2 shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      >
        开始使用
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}

// ============================================
// STEP: PROVIDER
// ============================================

function _ProviderStep({
  onNext,
  selectedProviders,
  setSelectedProviders,
  activeProvider,
  setActiveProvider,
}: {
  onNext: () => void;
  selectedProviders: ProviderId[];
  setSelectedProviders: Dispatch<SetStateAction<ProviderId[]>>;
  activeProvider: ProviderId;
  setActiveProvider: (id: ProviderId) => void;
}) {
  const {
    data: providers,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.providers.list.useQuery();
  const providerList = normalizeProvidersList(providers);

  const utils = trpc.useUtils();
  const setEnabledProvidersMutation = trpc.providers.setEnabled.useMutation({
    onSuccess: () => {
      utils.providers.list.invalidate();
    },
  });

  const selectedProviderData = providerList.find(
    (p) => p.id === activeProvider,
  );

  const toggleProvider = (providerId: ProviderId) => {
    setSelectedProviders((prev) => {
      if (prev.includes(providerId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== providerId);
      }
      return [...prev, providerId];
    });
    setActiveProvider(providerId);
  };

  const canContinue = selectedProviders.length > 0;

  const providerIds = Object.keys(PROVIDER_INFO) as ProviderId[];
  const providerStatusById = new Map(
    providerList.map((provider) => [provider.id, provider]),
  );

  const lastEnabledSignature = useRef<string>("");
  useEffect(() => {
    if (selectedProviders.length === 0) return;
    const signature = selectedProviders.slice().sort().join(",");
    if (lastEnabledSignature.current === signature) return;
    lastEnabledSignature.current = signature;
    setEnabledProvidersMutation.mutate({
      providerIds: selectedProviders,
    });
  }, [selectedProviders, setEnabledProvidersMutation]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">选择提供商</h1>
        <p className="text-sm text-muted-foreground">
          选择要启用的提供商（至少一个）
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            可用提供商
          </span>
          <button
            type="button"
            onClick={() => refetch()}
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
            {providerIds.map((providerId) => {
              const status = providerStatusById.get(providerId);
              return (
                <ProviderCard
                  key={providerId}
                  provider={{
                    id: providerId,
                    name: PROVIDER_INFO[providerId].name,
                    description: PROVIDER_INFO[providerId].description,
                    available: status?.available,
                    authStatus: status?.authStatus,
                  }}
                  selected={selectedProviders.includes(providerId)}
                  onSelect={() => toggleProvider(providerId)}
                />
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedProviderData && selectedProviders.includes(activeProvider) && (
          <SetupInstructions
            providerId={activeProvider}
            available={selectedProviderData.available}
            authenticated={selectedProviderData.authStatus.authenticated}
          />
        )}
      </AnimatePresence>

      <div className="space-y-3 pt-2">
        <motion.button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "w-full h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-colors hover:bg-primary/90 flex items-center justify-center gap-2 shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)]",
            !canContinue && "opacity-50 cursor-not-allowed hover:bg-primary",
          )}
        >
          继续
          <ChevronRight className="w-4 h-4" />
        </motion.button>
        <p className="text-xs text-muted-foreground text-center">
          你可以随时在设置中更改提供商
        </p>
      </div>
    </motion.div>
  );
}

// ============================================
// STEP: REPOSITORY
// ============================================

function RepositoryStep({ onNext }: { onNext: () => void }) {
  const [, setSelectedProject] = useAtom(selectedProjectAtom);

  const utils = trpc.useUtils();

  const { data: recentProjects } = trpc.projects.list.useQuery();

  const selectProject = (project: {
    id: string;
    name: string;
    path: string;
    gitRemoteUrl: string | null;
    gitProvider: string | null;
    gitOwner: string | null;
    gitRepo: string | null;
  }) => {
    setSelectedProject({
      id: project.id,
      name: project.name,
      path: project.path,
      gitRemoteUrl: project.gitRemoteUrl,
      gitProvider: project.gitProvider as
        | "github"
        | "gitlab"
        | "bitbucket"
        | null,
      gitOwner: project.gitOwner,
      gitRepo: project.gitRepo,
    });
    onNext();
  };

  const openFolder = trpc.projects.openFolder.useMutation({
    onSuccess: (project) => {
      if (project) {
        utils.projects.list.setData(undefined, (oldData) => {
          if (!oldData) return [project];
          const exists = oldData.some((p) => p.id === project.id);
          if (exists) {
            return oldData.map((p) =>
              p.id === project.id ? { ...p, updatedAt: project.updatedAt } : p,
            );
          }
          return [project, ...oldData];
        });
        selectProject(project);
      }
    },
  });

  const handleSelectFolder = async () => {
    await openFolder.mutateAsync();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">选择仓库</h1>
        <p className="text-sm text-muted-foreground">
          选择一个本地文件夹开始工作
        </p>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleSelectFolder}
          disabled={openFolder.isPending}
          className={cn(
            "w-full p-8 rounded-md border-2 border-dashed border-border",
            "hover:border-primary/50 hover:bg-muted/30",
            "transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {openFolder.isPending ? (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-1">
              <p className="font-medium text-sm">选择项目文件夹</p>
              <p className="text-xs text-muted-foreground">
                选择一个本地仓库开始编程
              </p>
            </div>
          </div>
        </button>

        {recentProjects && recentProjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              最近项目
            </p>
            <div className="space-y-1">
              {recentProjects.slice(0, 3).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => selectProject(project)}
                  className={cn(
                    "w-full p-2.5 rounded-md text-left",
                    "hover:bg-muted/50 transition-colors",
                    "flex items-center gap-2.5",
                  )}
                >
                  <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// STEP: READY
// ============================================

function ReadyStep({ onComplete }: { onComplete: () => void }) {
  const tips = [
    { icon: Sparkles, text: "进入应用后，在设置中添加接口服务商" },
    { icon: Terminal, text: "填写 Base URL、API Key、模型列表和上下文长度" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
    >
      <div className="text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.2 }}
          >
            <Check className="w-8 h-8 text-primary-foreground" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="space-y-2"
        >
          <h1 className="text-xl font-semibold tracking-tight">
            一切准备就绪！
          </h1>
          <p className="text-sm text-muted-foreground">
            项目已准备好，下一步请配置接口服务商
          </p>
        </motion.div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wide">
          快速提示
        </p>
        <div className="space-y-2">
          {tips.map((tip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-2.5 text-sm text-muted-foreground p-3 rounded-md bg-muted/30"
            >
              <tip.icon className="w-4 h-4 shrink-0" />
              <span>{tip.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.button
        type="button"
        onClick={onComplete}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileTap={{ scale: 0.97 }}
        className="w-full h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium transition-colors hover:bg-primary/90 flex items-center justify-center gap-2 shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      >
        进入 SamBetterCode
        <Sparkles className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}

// ============================================
// MAIN WIZARD
// ============================================

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const setOnboardingCompleted = useSetAtom(onboardingCompletedAtom);
  const steps: Step[] = ["welcome", "repository", "ready"];

  const handleComplete = () => {
    setOnboardingCompleted(true);
  };

  const goToNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];
    if (nextStep) setCurrentStep(nextStep);
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background select-none">
      <div
        className="fixed top-0 left-0 right-0 h-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="no-drag w-full max-w-[520px] space-y-6 px-6">
        <StepProgress steps={steps} currentStep={currentStep} />
        <AnimatePresence mode="wait">
          {currentStep === "welcome" && (
            <WelcomeStep key="welcome" onNext={goToNext} />
          )}
          {currentStep === "repository" && (
            <RepositoryStep key="repository" onNext={goToNext} />
          )}
          {currentStep === "ready" && (
            <ReadyStep key="ready" onComplete={handleComplete} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
