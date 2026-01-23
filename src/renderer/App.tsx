import { Provider as JotaiProvider, useAtomValue } from "jotai";
import { ThemeProvider, useTheme } from "next-themes";
import { useMemo } from "react";
import { Toaster } from "sonner";
import { AppLoadingScreen } from "./components/app-loading-screen";
import { TooltipProvider } from "./components/ui/tooltip";
import { TRPCProvider } from "./contexts/TRPCProvider";
import { selectedProjectAtom } from "./features/agents/atoms";
import { AgentsLayout } from "./features/layout/agents-layout";
import { OnboardingWizard } from "./features/onboarding";
import { onboardingCompletedAtom } from "./lib/atoms";
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
