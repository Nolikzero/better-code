import { Provider as JotaiProvider, useAtomValue } from "jotai";
import { ThemeProvider, useTheme } from "next-themes";
import { useMemo } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { TRPCProvider } from "./contexts/TRPCProvider";
import { selectedProjectAtom } from "./features/agents/atoms";
import { AgentsLayout } from "./features/layout/agents-layout";
import { AnthropicOnboardingPage, SelectRepoPage } from "./features/onboarding";
import { anthropicOnboardingCompletedAtom } from "./lib/atoms";
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
  const anthropicOnboardingCompleted = useAtomValue(
    anthropicOnboardingCompletedAtom,
  );
  const selectedProject = useAtomValue(selectedProjectAtom);

  // Fetch projects to validate selectedProject exists
  const { data: projects, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery();

  // Validated project - only valid if exists in DB
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null;
    // While loading, trust localStorage value to prevent flicker
    if (isLoadingProjects) return selectedProject;
    // After loading, validate against DB
    if (!projects) return null;
    const exists = projects.some((p) => p.id === selectedProject.id);
    return exists ? selectedProject : null;
  }, [selectedProject, projects, isLoadingProjects]);

  // Determine which page to show:
  // 1. Anthropic onboarding not completed -> AnthropicOnboardingPage
  // 2. No valid project selected -> SelectRepoPage
  // 3. Otherwise -> AgentsLayout
  if (!anthropicOnboardingCompleted) {
    return <AnthropicOnboardingPage />;
  }

  if (!validatedProject && !isLoadingProjects) {
    return <SelectRepoPage />;
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
