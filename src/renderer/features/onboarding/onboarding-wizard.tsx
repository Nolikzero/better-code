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
  defaultProviderIdAtom,
  enabledProviderIdsAtom,
  onboardingCompletedAtom,
  PROVIDER_INFO,
  type ProviderId,
} from "../../lib/atoms";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import { selectedProjectAtom } from "../agents/atoms";
import { getProviderIcon } from "../agents/ui/provider-icons";

// ============================================
// TYPES
// ============================================

type Step = "welcome" | "provider" | "repository" | "ready";

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
        Optional
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
        Checking
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
        Install
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
        Setup Required
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="text-[10px] py-0 px-1.5 font-normal gap-1 text-primary border-primary/20 bg-primary/5"
    >
      <Check className="w-2.5 h-2.5" />
      Ready
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
              Install Claude Code CLI:
            </p>
            <CopyableCommand command="curl -fsSL https://claude.ai/install.sh | sh" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            2
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">Then authenticate:</p>
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
        <p className="text-sm text-muted-foreground">Open Terminal</p>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
          2
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            Run the login command:
          </p>
          <CopyableCommand command="claude login" />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
          3
        </div>
        <p className="text-sm text-muted-foreground">
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
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            1
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">Install Codex CLI:</p>
            <CopyableCommand command="npm install -g @openai/codex" />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium shrink-0 mt-0.5">
            2
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">Then authenticate:</p>
            <CopyableCommand command="codex login" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Option 1: Login with OpenAI
      </p>
      <CopyableCommand command="codex login" />
      <div className="pt-2">
        <p className="text-xs font-medium text-muted-foreground">
          Option 2: Use API Key
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Set the <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code>{" "}
          environment variable
        </p>
      </div>
    </div>
  );
}

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
          {PROVIDER_INFO[providerId].name} is ready to use
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
        {providerId === "claude" && (
          <ClaudeInstructions installed={available} />
        )}
        {providerId === "codex" && <CodexInstructions installed={available} />}
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
    id: string;
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
            provider.id === "claude" && "bg-[#D97757]/10",
            provider.id === "codex" && "bg-[#10A37F]/10",
            provider.id === "opencode" && "bg-[#6366F1]/10",
          )}
        >
          {getProviderIcon(
            provider.id as ProviderId,
            cn(
              "w-5 h-5",
              provider.id === "claude" && "text-[#D97757]",
              provider.id === "codex" && "text-[#10A37F]",
              provider.id === "opencode" && "text-[#6366F1]",
            ),
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
            Welcome to BetterCode
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your AI-powered coding assistant. Let's get you set up in just a few
            steps.
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
        Get Started
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}

// ============================================
// STEP: PROVIDER
// ============================================

function ProviderStep({
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

  const utils = trpc.useUtils();
  const setEnabledProvidersMutation = trpc.providers.setEnabled.useMutation({
    onSuccess: () => {
      utils.providers.list.invalidate();
    },
  });

  const selectedProviderData = providers?.find((p) => p.id === activeProvider);

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
    (providers || []).map((provider) => [provider.id, provider]),
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
        <h1 className="text-xl font-semibold tracking-tight">
          Choose Your Provider
        </h1>
        <p className="text-sm text-muted-foreground">
          Select the providers you want to enable (at least one)
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Available Providers
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
          Continue
          <ChevronRight className="w-4 h-4" />
        </motion.button>
        <p className="text-xs text-muted-foreground text-center">
          You can change your providers anytime in Settings
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
        <h1 className="text-xl font-semibold tracking-tight">
          Select a Repository
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a local folder to start working with
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
              <p className="font-medium text-sm">Select a project folder</p>
              <p className="text-xs text-muted-foreground">
                Choose a local repository to start coding
              </p>
            </div>
          </div>
        </button>

        {recentProjects && recentProjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recent Projects
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
    { icon: Terminal, text: "Use / commands for quick actions" },
    { icon: Sparkles, text: "Plan mode helps structure complex tasks" },
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
            You're All Set!
          </h1>
          <p className="text-sm text-muted-foreground">
            BetterCode is ready to help you code faster
          </p>
        </motion.div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wide">
          Quick Tips
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
        Start Coding
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
  const [enabledProviders, setEnabledProviders] = useAtom(
    enabledProviderIdsAtom,
  );
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>(
    enabledProviders.length > 0 ? enabledProviders : [],
  );
  const [activeProvider, setActiveProvider] = useState<ProviderId>(
    selectedProviders[0] ?? "claude",
  );

  const setOnboardingCompleted = useSetAtom(onboardingCompletedAtom);
  const setDefaultProvider = useSetAtom(defaultProviderIdAtom);

  const steps: Step[] = ["welcome", "provider", "repository", "ready"];

  useEffect(() => {
    if (selectedProviders.length === 0) return;
    if (!selectedProviders.includes(activeProvider)) {
      setActiveProvider(selectedProviders[0]);
    }
  }, [activeProvider, selectedProviders]);

  const handleComplete = () => {
    const fallbackProvider = selectedProviders[0] || "claude";
    setEnabledProviders(selectedProviders);
    setDefaultProvider(fallbackProvider);
    setOnboardingCompleted(true);
  };

  const goToNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background select-none">
      {/* Draggable title bar area */}
      <div
        className="fixed top-0 left-0 right-0 h-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="w-full max-w-[520px] space-y-6 px-6">
        {/* Progress */}
        <StepProgress steps={steps} currentStep={currentStep} />

        {/* Content */}
        <AnimatePresence mode="wait">
          {currentStep === "welcome" && (
            <WelcomeStep key="welcome" onNext={goToNext} />
          )}
          {currentStep === "provider" && (
            <ProviderStep
              key="provider"
              onNext={goToNext}
              selectedProviders={selectedProviders}
              setSelectedProviders={setSelectedProviders}
              activeProvider={activeProvider}
              setActiveProvider={setActiveProvider}
            />
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
