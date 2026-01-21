import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentsSettingsDialog } from "../../components/dialogs/agents-settings-dialog";
import { AgentsShortcutsDialog } from "../../components/dialogs/agents-shortcuts-dialog";
import { LoginModal } from "../../components/dialogs/login-modal";
import { QuickOpenDialog } from "../../components/ui/quick-open-dialog";
import { ResizableSidebar } from "../../components/ui/resizable-sidebar";
import { TooltipProvider } from "../../components/ui/tooltip";
import { UpdateBanner } from "../../components/update-banner";
import {
  agentsSettingsDialogActiveTabAtom,
  agentsSettingsDialogOpenAtom,
  agentsShortcutsDialogOpenAtom,
  agentsSidebarOpenAtom,
  agentsSidebarWidthAtom,
  chatsSidebarOpenAtom,
  chatsSidebarWidthAtom,
  isDesktopAtom,
  isFullscreenAtom,
  onboardingCompletedAtom,
  quickOpenDialogOpenAtom,
} from "../../lib/atoms";
import { useIsMobile } from "../../lib/hooks/use-mobile";
import { useUpdateChecker } from "../../lib/hooks/use-update-checker";
import { trpc } from "../../lib/trpc";
import { isDesktopApp } from "../../lib/utils/platform";
import {
  activeChatDiffDataAtom,
  leftSidebarExpandedWidthAtom,
  selectedAgentChatIdAtom,
  selectedProjectAtom,
} from "../agents/atoms";
import { useAgentsHotkeys } from "../agents/lib/agents-hotkeys-manager";
import { useAgentSubChatStore } from "../agents/stores/sub-chat-store";
import { AgentsContent } from "../agents/ui/agents-content";
import { AgentsSidebar } from "../sidebar/agents-sidebar";
import { ChatsSidebar } from "../sidebar/chats-sidebar";

// ============================================================================
// Constants
// ============================================================================

// Left sidebar - expanded (with file list, when there are changes)
const LEFT_SIDEBAR_EXPANDED_MIN_WIDTH = 200;
const LEFT_SIDEBAR_EXPANDED_MAX_WIDTH = 350;

const LEFT_SIDEBAR_CLOSE_HOTKEY = "⌘\\";

// Right sidebar - chats list
const RIGHT_SIDEBAR_MIN_WIDTH = 200;
const RIGHT_SIDEBAR_MAX_WIDTH = 320;
const RIGHT_SIDEBAR_CLOSE_HOTKEY = "⌘⇧\\";

const SIDEBAR_ANIMATION_DURATION = 0;

// ============================================================================
// Component
// ============================================================================

export function AgentsLayout() {
  // No useHydrateAtoms - desktop doesn't need SSR, atomWithStorage handles persistence
  const isMobile = useIsMobile();

  // Global desktop/fullscreen state - initialized here at root level
  const [isDesktop, setIsDesktop] = useAtom(isDesktopAtom);
  const [, setIsFullscreen] = useAtom(isFullscreenAtom);

  // Initialize isDesktop on mount
  useEffect(() => {
    setIsDesktop(isDesktopApp());
  }, [setIsDesktop]);

  // Subscribe to fullscreen changes from Electron
  useEffect(() => {
    if (
      !isDesktop ||
      typeof window === "undefined" ||
      !window.desktopApi?.windowIsFullscreen
    )
      return;

    // Get initial fullscreen state
    window.desktopApi.windowIsFullscreen().then(setIsFullscreen);

    // In dev mode, HMR breaks IPC event subscriptions, so we poll instead
    const isDev = import.meta.env.DEV;
    if (isDev) {
      const interval = setInterval(() => {
        window.desktopApi?.windowIsFullscreen?.().then(setIsFullscreen);
      }, 300);
      return () => clearInterval(interval);
    }

    // In production, use events (more efficient)
    const unsubscribe = window.desktopApi.onFullscreenChange?.(setIsFullscreen);
    return unsubscribe;
  }, [isDesktop, setIsFullscreen]);

  // Check for updates on mount and periodically
  useUpdateChecker();

  // Left sidebar state (project selector)
  const [sidebarOpen, setSidebarOpen] = useAtom(agentsSidebarOpenAtom);
  const [_sidebarWidth, _setSidebarWidth] = useAtom(agentsSidebarWidthAtom);

  // Check if diff data exists with changes (for dynamic left sidebar width)
  const activeDiffData = useAtomValue(activeChatDiffDataAtom);
  const hasChanges = activeDiffData?.diffStats.hasChanges ?? false;

  // Read selectedChatId early for sidebar visibility logic
  const selectedChatIdValue = useAtomValue(selectedAgentChatIdAtom);
  // Dynamic sidebar width based on whether project is selected or changes exist
  // Icon-only mode: fixed width, not resizable
  // Expanded mode: resizable within min/max bounds
  const leftSidebarMinWidth = LEFT_SIDEBAR_EXPANDED_MIN_WIDTH;
  const leftSidebarMaxWidth = LEFT_SIDEBAR_EXPANDED_MAX_WIDTH;
  const leftSidebarWidthAtom = leftSidebarExpandedWidthAtom;

  // Right sidebar state (chats)
  const [chatsSidebarOpen, setChatsSidebarOpen] = useAtom(chatsSidebarOpenAtom);
  const [_chatsSidebarWidth, _setChatsSidebarWidth] = useAtom(
    chatsSidebarWidthAtom,
  );

  const [settingsOpen, setSettingsOpen] = useAtom(agentsSettingsDialogOpenAtom);
  const setSettingsActiveTab = useSetAtom(agentsSettingsDialogActiveTabAtom);
  const [shortcutsOpen, setShortcutsOpen] = useAtom(
    agentsShortcutsDialogOpenAtom,
  );
  const setQuickOpenDialogOpen = useSetAtom(quickOpenDialogOpenAtom);
  const [selectedChatId, setSelectedChatId] = useAtom(selectedAgentChatIdAtom);
  const [selectedProject, setSelectedProject] = useAtom(selectedProjectAtom);
  const setOnboardingCompleted = useSetAtom(onboardingCompletedAtom);

  // Fetch projects to validate selectedProject exists
  const { data: projects, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery();

  // Validated project - only valid if exists in DB
  // While loading, trust localStorage value to prevent clearing on app restart
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null;
    // While loading, trust localStorage value to prevent flicker and clearing
    if (isLoadingProjects) return selectedProject;
    // After loading, validate against DB
    if (!projects) return null;
    const exists = projects.some((p) => p.id === selectedProject.id);
    return exists ? selectedProject : null;
  }, [selectedProject, projects, isLoadingProjects]);

  // Clear invalid project from storage (only after loading completes)
  useEffect(() => {
    if (
      selectedProject &&
      projects &&
      !isLoadingProjects &&
      !validatedProject
    ) {
      setSelectedProject(null);
    }
  }, [
    selectedProject,
    projects,
    isLoadingProjects,
    validatedProject,
    setSelectedProject,
  ]);

  // Hide native traffic lights when sidebar is closed (no traffic lights needed when sidebar is closed)
  useEffect(() => {
    if (!isDesktop) return;
    if (
      typeof window === "undefined" ||
      !window.desktopApi?.setTrafficLightVisibility
    )
      return;

    // When sidebar is closed, hide native traffic lights
    // When sidebar is open, TrafficLights component handles visibility
    if (!sidebarOpen) {
      window.desktopApi.setTrafficLightVisibility(false);
    }
  }, [sidebarOpen, isDesktop]);
  const setChatId = useAgentSubChatStore((state) => state.setChatId);

  // Desktop user state
  const [desktopUser, setDesktopUser] = useState<{
    id: string;
    email: string;
    name: string | null;
    imageUrl: string | null;
    username: string | null;
  } | null>(null);

  // Fetch desktop user on mount
  useEffect(() => {
    async function fetchUser() {
      if (window.desktopApi?.getUser) {
        const user = await window.desktopApi.getUser();
        setDesktopUser(user);
      }
    }
    fetchUser();
  }, []);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    // Clear selected project and onboarding on logout
    setSelectedProject(null);
    setSelectedChatId(null);
    setOnboardingCompleted(false);
    if (window.desktopApi?.logout) {
      await window.desktopApi.logout();
    }
  }, [setSelectedProject, setSelectedChatId, setOnboardingCompleted]);

  // Initialize sub-chats when chat is selected
  useEffect(() => {
    if (selectedChatId) {
      setChatId(selectedChatId);
    } else {
      setChatId(null);
    }
  }, [selectedChatId, setChatId]);

  // ============================================================================
  // Branch switching for local-mode chats
  // ============================================================================
  // NOTE: Auto-switching git branch when selecting a chat is disabled for local mode.
  // Instead, branch switching happens with user confirmation when:
  // 1. Creating a new sub-chat (in agents-sidebar.tsx, agents-subchats-sidebar.tsx, active-chat.tsx)
  // 2. Sending a message to continue a conversation (in active-chat.tsx)
  // This prevents unexpected branch switches when just browsing between chats.

  // Initialize hotkeys manager
  useAgentsHotkeys({
    setSelectedChatId,
    setSidebarOpen,
    setSettingsDialogOpen: setSettingsOpen,
    setSettingsActiveTab,
    setShortcutsDialogOpen: setShortcutsOpen,
    setQuickOpenDialogOpen,
    selectedChatId,
    setChatsSidebarOpen,
  });

  // Handle notification clicks - navigate to the chat/subchat
  const setActiveSubChat = useAgentSubChatStore(
    (state) => state.setActiveSubChat,
  );
  const addToOpenSubChats = useAgentSubChatStore(
    (state) => state.addToOpenSubChats,
  );

  useEffect(() => {
    if (!isDesktop || !window.desktopApi?.onNotificationClicked) return;

    const unsubscribe = window.desktopApi.onNotificationClicked((data) => {
      if (data.chatId) {
        setSelectedChatId(data.chatId);
      }
      if (data.subChatId) {
        addToOpenSubChats(data.subChatId);
        setActiveSubChat(data.subChatId);
      }
    });

    return unsubscribe;
  }, [isDesktop, setSelectedChatId, setActiveSubChat, addToOpenSubChats]);

  // Handle dock menu clicks - navigate to the chat (macOS only)
  useEffect(() => {
    if (!isDesktop || !window.desktopApi?.onDockNavigateToChat) return;

    const unsubscribe = window.desktopApi.onDockNavigateToChat((data) => {
      if (data.chatId) {
        setSelectedChatId(data.chatId);
      }
    });

    return unsubscribe;
  }, [isDesktop, setSelectedChatId]);

  // Handle tray menu clicks - navigate to the chat (all platforms)
  useEffect(() => {
    if (!isDesktop || !window.desktopApi?.onTrayNavigateToChat) return;

    const unsubscribe = window.desktopApi.onTrayNavigateToChat((data) => {
      if (data.chatId) {
        setSelectedChatId(data.chatId);
      }
    });

    return unsubscribe;
  }, [isDesktop, setSelectedChatId]);

  // Handle tray preferences click - open settings dialog
  useEffect(() => {
    if (!isDesktop || !window.desktopApi?.onTrayOpenPreferences) return;

    const unsubscribe = window.desktopApi.onTrayOpenPreferences(() => {
      setSettingsOpen(true);
    });

    return unsubscribe;
  }, [isDesktop, setSettingsOpen]);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  useEffect(() => {
    setSidebarOpen(!!selectedChatId);
  }, [selectedChatId, setChatsSidebarOpen]);

  const handleCloseChatsSidebar = useCallback(() => {
    setChatsSidebarOpen(false);
  }, [setChatsSidebarOpen]);

  return (
    <TooltipProvider delayDuration={300}>
      <AgentsSettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <AgentsShortcutsDialog
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <LoginModal />
      <QuickOpenDialog />
      <div className="flex w-full h-full relative overflow-hidden bg-background select-none">
        {/* Left Sidebar (Project Selector + File Tree + Changes) */}
        <ResizableSidebar
          isOpen={!isMobile && sidebarOpen}
          onClose={handleCloseSidebar}
          widthAtom={leftSidebarWidthAtom}
          minWidth={leftSidebarMinWidth}
          maxWidth={leftSidebarMaxWidth}
          side="left"
          closeHotkey={LEFT_SIDEBAR_CLOSE_HOTKEY}
          animationDuration={SIDEBAR_ANIMATION_DURATION}
          initialWidth={0}
          exitWidth={0}
          showResizeTooltip={true}
          className="overflow-hidden bg-background border-r"
          style={{ borderRightWidth: "0.5px" }}
        >
          <AgentsSidebar
            desktopUser={desktopUser}
            onSignOut={handleSignOut}
            onToggleSidebar={handleCloseSidebar}
            hasChanges={hasChanges}
          />
        </ResizableSidebar>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <AgentsContent />
        </div>

        {/* Right Sidebar (Chats) - hidden when no chat selected */}
        <ResizableSidebar
          isOpen={!isMobile && chatsSidebarOpen && !!selectedChatIdValue}
          onClose={handleCloseChatsSidebar}
          widthAtom={chatsSidebarWidthAtom}
          minWidth={RIGHT_SIDEBAR_MIN_WIDTH}
          maxWidth={RIGHT_SIDEBAR_MAX_WIDTH}
          side="right"
          closeHotkey={RIGHT_SIDEBAR_CLOSE_HOTKEY}
          animationDuration={SIDEBAR_ANIMATION_DURATION}
          initialWidth={0}
          exitWidth={0}
          showResizeTooltip={true}
          className="overflow-hidden bg-background border-l"
          style={{ borderLeftWidth: "0.5px" }}
        >
          <ChatsSidebar onToggleSidebar={handleCloseChatsSidebar} />
        </ResizableSidebar>

        {/* Update Banner */}
        <UpdateBanner />
      </div>
    </TooltipProvider>
  );
}
