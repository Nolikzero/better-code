import { Provider as JotaiProvider, useAtomValue, useSetAtom } from "jotai";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useMemo } from "react";
import { Toaster } from "sonner";
import { AppLoadingScreen } from "./components/app-loading-screen";
import { TooltipProvider } from "./components/ui/tooltip";
import { TRPCProvider } from "./contexts/TRPCProvider";
import { selectedProjectAtom } from "./features/agents/atoms";
import { normalizeProvidersList } from "./features/agents/hooks/use-providers";
import { AgentsLayout } from "./features/layout/agents-layout";
import { OnboardingWizard } from "./features/onboarding";
import {
  defaultProviderIdAtom,
  enabledProviderIdsAtom,
  onboardingCompletedAtom,
} from "./lib/atoms";
import { appStore } from "./lib/jotai-store";
import { VSCodeThemeProvider } from "./lib/themes/theme-provider";
import { trpc } from "./lib/trpc";

/**
 * Custom Toaster that adapts to theme
 */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme as "light" | "dark" | "system"}
      containerAriaLabel="通知"
      closeButton
    />
  );
}

/**
 * Main content router - decides which page to show based on onboarding state
 */
function AppContent() {
  const onboardingCompleted = useAtomValue(onboardingCompletedAtom);
  const selectedProject = useAtomValue(selectedProjectAtom);
  const enabledProviders = useAtomValue(enabledProviderIdsAtom);
  const defaultProvider = useAtomValue(defaultProviderIdAtom);
  const setDefaultProvider = useSetAtom(defaultProviderIdAtom);
  const setEnabledProviders = useSetAtom(enabledProviderIdsAtom);
  const { data: providerData } = trpc.providers.list.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const providerList = useMemo(
    () => normalizeProvidersList(providerData),
    [providerData],
  );

  // Fetch projects to validate selectedProject exists
  const {
    data: projects,
    isLoading: isLoadingProjects,
    isFetched,
  } = trpc.projects.list.useQuery();

  // Validated project - only valid after DB check completes
  const validatedProject = useMemo(() => {
    if (!selectedProject || !projects) return null;
    const exists = projects.some((p) => p.id === selectedProject.id);
    return exists ? selectedProject : null;
  }, [selectedProject, projects]);

  useEffect(() => {
    if (!providerData) return;
    const serverEnabled = providerList
      .filter((provider) => provider.enabled)
      .map((provider) => provider.id);
    const localSignature = enabledProviders.slice().sort().join(",");
    const serverSignature = serverEnabled.slice().sort().join(",");
    if (localSignature !== serverSignature) {
      setEnabledProviders(serverEnabled);
    }
  }, [enabledProviders, providerData, providerList, setEnabledProviders]);

  useEffect(() => {
    const validDefault = providerList.some(
      (provider) => provider.enabled && provider.id === defaultProvider,
    );
    if (validDefault) return;
    const replacement = providerList.find((provider) => provider.enabled);
    if ((replacement?.id ?? "") !== defaultProvider) {
      setDefaultProvider(replacement?.id ?? "");
    }
  }, [defaultProvider, providerList, setDefaultProvider]);

  // Show loading screen until projects query resolves
  // (only when onboarding is done - otherwise show onboarding directly)
  if (onboardingCompleted && !isFetched) {
    return <AppLoadingScreen />;
  }

  if (!onboardingCompleted || (!validatedProject && !isLoadingProjects)) {
    return <OnboardingWizard />;
  }

  return <AgentsLayout />;
}

export function App() {
  return (
    <JotaiProvider store={appStore}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TRPCProvider>
          <VSCodeThemeProvider>
            <TooltipProvider delayDuration={100}>
              <div
                data-agents-page
                className="h-screen w-screen bg-background text-foreground overflow-hidden"
              >
                <AppContent />
              </div>
              <ThemedToaster />
            </TooltipProvider>
          </VSCodeThemeProvider>
        </TRPCProvider>
      </ThemeProvider>
    </JotaiProvider>
  );
}
