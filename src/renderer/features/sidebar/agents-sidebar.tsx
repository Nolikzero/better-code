"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button as ButtonCustom } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  IconDoubleChevronLeft,
  KeyboardIcon,
  ProfileIcon,
  QuestionCircleIcon,
  SettingsIcon,
} from "../../components/ui/icons";
import { Kbd } from "../../components/ui/kbd";
import { Logo } from "../../components/ui/logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  agentsSettingsDialogActiveTabAtom,
  agentsSettingsDialogOpenAtom,
  agentsShortcutsDialogOpenAtom,
  isDesktopAtom,
  isFullscreenAtom,
} from "../../lib/atoms";
import { cn } from "../../lib/utils";
import {
  effectiveDiffDataAtom,
  leftSidebarActiveTabAtom,
  selectedAgentChatIdAtom,
  selectedDraftIdAtom,
  selectedProjectAtom,
} from "../agents/atoms";
import {
  TrafficLightSpacer,
  TrafficLights,
} from "../agents/components/traffic-light-spacer";
import {
  LeftSidebarChangesView,
  LeftSidebarTabs,
  ProjectFileTree,
  ProjectSelectorHeader,
} from "./components";
import { useHaptic } from "./hooks/use-haptic";

// Stub for useCombinedAuth
const useCombinedAuth = () => ({ userId: null, isLoaded: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AuthDialog = (_props: any) => null;

interface AgentsSidebarProps {
  userId?: string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clerkUser?: any;
  desktopUser?: {
    id: string;
    email: string;
    name?: string | null;
    imageUrl?: string | null;
    username?: string | null;
  } | null;
  onSignOut?: () => void;
  onToggleSidebar?: () => void;
  isMobileFullscreen?: boolean;
  onChatSelect?: () => void;
  hasChanges?: boolean;
}

export function AgentsSidebar({
  userId = "demo-user-id",
  desktopUser = {
    id: "demo-user-id",
    email: "demo@example.com",
    name: "Demo User",
  },
  onSignOut = () => {},
  onToggleSidebar,
  isMobileFullscreen = false,
  onChatSelect,
  hasChanges = false,
}: AgentsSidebarProps) {
  const setSelectedChatId = useSetAtom(selectedAgentChatIdAtom);
  const [, setSelectedDraftId] = useAtom(selectedDraftIdAtom);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Global desktop/fullscreen state from atoms
  const isDesktop = useAtomValue(isDesktopAtom);
  const isFullscreen = useAtomValue(isFullscreenAtom);

  // Project and sidebar tab state
  const selectedProject = useAtomValue(selectedProjectAtom);
  const activeTab = useAtomValue(leftSidebarActiveTabAtom);

  // Project-level and multi-repo diff management are handled by agents-content.tsx
  // (single instance per hook to avoid conflicting atom writes)

  // Use centralized effective diff data for consistent count and view
  const { diffData: effectiveDiffData, showMultiRepo, multiRepoDiffData } =
    useAtomValue(effectiveDiffDataAtom);
  const multiRepoChangesCount = multiRepoDiffData?.repos.reduce(
    (sum, repo) => sum + (repo.diffStats?.fileCount ?? 0),
    0,
  ) ?? 0;
  const changesCount = showMultiRepo
    ? multiRepoChangesCount
    : (effectiveDiffData?.diffStats?.fileCount ?? 0);

  const setSettingsDialogOpen = useSetAtom(agentsSettingsDialogOpenAtom);
  const setSettingsActiveTab = useSetAtom(agentsSettingsDialogActiveTabAtom);
  const setShortcutsDialogOpen = useSetAtom(agentsShortcutsDialogOpenAtom);
  const { isLoaded: _isAuthLoaded } = useCombinedAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Haptic feedback
  const { trigger: triggerHaptic } = useHaptic();

  const handleNewAgent = () => {
    triggerHaptic("light");
    setSelectedChatId(null);
    setSelectedDraftId(null);
    if (isMobileFullscreen && onChatSelect) {
      onChatSelect();
    }
  };

  // Icon-only layout when no changes
  const iconOnlySidebar = (
    <div
      className="group/sidebar flex flex-col items-center gap-0 overflow-hidden select-none h-full bg-transparent"
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={(e) => {
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !(relatedTarget instanceof HTMLElement)) return;
        const isStillInSidebar = relatedTarget.closest(
          "[data-sidebar-content]",
        );
        if (!isStillInSidebar) {
          setIsSidebarHovered(false);
        }
      }}
      data-sidebar-content
    >
      {/* Traffic lights area */}
      {isDesktop && !isFullscreen && (
        <div
          className="w-full h-[32px] shrink-0"
          style={{
            // @ts-expect-error - WebKit-specific property
            WebkitAppRegion: "drag",
          }}
        />
      )}
      <TrafficLights
        isHovered={isSidebarHovered || isDropdownOpen}
        isFullscreen={isFullscreen}
        isDesktop={isDesktop}
        className="absolute left-3 top-[10px] z-20"
      />

      {/* Logo with dropdown menu */}
      <div className="px-2 pt-1">
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <TooltipProvider>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <ButtonCustom
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0 hover:bg-foreground/10 rounded-md"
                    suppressHydrationWarning
                  >
                    <Logo className="w-4 h-4" />
                  </ButtonCustom>
                </TooltipTrigger>
                <TooltipContent side="right">Menu</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 pt-0"
            sideOffset={8}
          >
            {userId ? (
              <>
                {/* Profile section */}
                <div className="relative rounded-t-xl border-b overflow-hidden">
                  <div className="absolute inset-0 bg-popover brightness-110" />
                  <div className="relative pl-2 pt-1.5 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-background shrink-0 overflow-hidden">
                        <Logo className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="font-medium text-sm text-foreground truncate">
                          {desktopUser?.name || "User"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {desktopUser?.email}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => {
                    setIsDropdownOpen(false);
                    setSettingsActiveTab("profile");
                    setSettingsDialogOpen(true);
                  }}
                >
                  <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <QuestionCircleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1">Help</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className="w-36"
                    sideOffset={6}
                    alignOffset={-4}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsDropdownOpen(false);
                        setShortcutsDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <KeyboardIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1">Shortcuts</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => onSignOut()}
                >
                  <svg
                    className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="16,17 21,12 16,7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1="21"
                      y1="12"
                      x2="9"
                      y2="12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Log out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => {
                    setIsDropdownOpen(false);
                    setShowAuthDialog(true);
                  }}
                >
                  <ProfileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  Login
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <QuestionCircleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1">Help</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className="w-36"
                    sideOffset={6}
                    alignOffset={-4}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setIsDropdownOpen(false);
                        setShortcutsDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <KeyboardIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1">Shortcuts</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New chat button */}
      <div className="px-2 pt-2">
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <ButtonCustom
                variant="ghost"
                size="icon"
                onClick={handleNewAgent}
                className="h-8 w-8 p-0 hover:bg-foreground/10 rounded-md"
              >
                <Plus className="h-4 w-4" />
              </ButtonCustom>
            </TooltipTrigger>
            <TooltipContent side="right">New chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Project selector (icon only) */}
      <ProjectSelectorHeader onNewWorkspace={handleNewAgent} isIconOnly />

      {/* Spacer to push content up */}
      <div className="flex-1" />
    </div>
  );

  const sidebarContent = (
    <div
      className={cn(
        "group/sidebar flex flex-col gap-0 overflow-hidden select-none",
        isMobileFullscreen
          ? "h-full w-full bg-transparent"
          : "h-full bg-transparent",
      )}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={(e) => {
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !(relatedTarget instanceof HTMLElement)) return;
        const isStillInSidebar = relatedTarget.closest(
          "[data-sidebar-content]",
        );
        if (!isStillInSidebar) {
          setIsSidebarHovered(false);
        }
      }}
      data-mobile-fullscreen={isMobileFullscreen || undefined}
      data-sidebar-content
    >
      {/* Header area with close button at top-right */}
      <div
        className="relative shrink-0"
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={(e) => {
          const relatedTarget = e.relatedTarget;
          if (!relatedTarget || !(relatedTarget instanceof HTMLElement)) return;
          const isStillInSidebar = relatedTarget.closest(
            "[data-sidebar-content]",
          );
          if (!isStillInSidebar) {
            setIsSidebarHovered(false);
          }
        }}
      >
        {/* Draggable area for window movement */}
        {isDesktop && !isFullscreen && (
          <div
            className="absolute inset-x-0 top-0 h-[32px] z-0"
            style={{
              // @ts-expect-error - WebKit-specific property
              WebkitAppRegion: "drag",
            }}
            data-sidebar-content
          />
        )}

        {/* Custom traffic lights */}
        <TrafficLights
          isHovered={isSidebarHovered || isDropdownOpen}
          isFullscreen={isFullscreen}
          isDesktop={isDesktop}
          className="absolute left-3 top-[10px] z-20"
        />

        {/* Close button */}
        {!isMobileFullscreen && (
          <div
            className={cn(
              "absolute right-2 z-20 transition-opacity duration-150",
              "top-2",
              isSidebarHovered || isDropdownOpen ? "opacity-100" : "opacity-0",
            )}
            style={{
              // @ts-expect-error - WebKit-specific property
              WebkitAppRegion: "no-drag",
            }}
          >
            <TooltipProvider>
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <ButtonCustom
                    variant="ghost"
                    size="icon"
                    onClick={onToggleSidebar}
                    tabIndex={-1}
                    className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground shrink-0 rounded-md"
                    aria-label="Close sidebar"
                  >
                    <IconDoubleChevronLeft className="h-4 w-4" />
                  </ButtonCustom>
                </TooltipTrigger>
                <TooltipContent>
                  Close sidebar
                  <Kbd>⌘\</Kbd>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Spacer for macOS traffic lights */}
        <TrafficLightSpacer isFullscreen={isFullscreen} isDesktop={isDesktop} />

        {/* Team dropdown */}
        <div className="px-2 pt-2 pb-2">
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <DropdownMenu
                open={isDropdownOpen}
                onOpenChange={setIsDropdownOpen}
              >
                <DropdownMenuTrigger asChild>
                  <ButtonCustom
                    variant="ghost"
                    className="h-6 px-1.5 justify-start hover:bg-foreground/10 rounded-md group/team-button max-w-full"
                    suppressHydrationWarning
                  >
                    <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                      <div className="flex items-center justify-center shrink-0">
                        <Logo className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="text-sm font-medium text-foreground truncate">
                          Better Code
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-3 text-muted-foreground shrink-0 overflow-hidden",
                          isDropdownOpen
                            ? "opacity-100 w-3"
                            : "opacity-0 w-0 group-hover/team-button:opacity-100 group-hover/team-button:w-3",
                        )}
                      />
                    </div>
                  </ButtonCustom>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-52 pt-0"
                  sideOffset={8}
                >
                  {userId ? (
                    <>
                      {/* Project section at the top */}
                      <div className="relative rounded-t-xl border-b overflow-hidden">
                        <div className="absolute inset-0 bg-popover brightness-110" />
                        <div className="relative pl-2 pt-1.5 pb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded flex items-center justify-center bg-background shrink-0 overflow-hidden">
                              <Logo className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="font-medium text-sm text-foreground truncate">
                                {desktopUser?.name || "User"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {desktopUser?.email}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Settings */}
                      <DropdownMenuItem
                        className="gap-2"
                        onSelect={() => {
                          setIsDropdownOpen(false);
                          setSettingsActiveTab("profile");
                          setSettingsDialogOpen(true);
                        }}
                      >
                        <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        Settings
                      </DropdownMenuItem>

                      {/* Help Submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                          <QuestionCircleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1">Help</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent
                          className="w-36"
                          sideOffset={6}
                          alignOffset={-4}
                        >
                          {!isMobileFullscreen && (
                            <DropdownMenuItem
                              onSelect={() => {
                                setIsDropdownOpen(false);
                                setShortcutsDialogOpen(true);
                              }}
                              className="gap-2"
                            >
                              <KeyboardIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1">Shortcuts</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator />

                      {/* Log out */}
                      <div className="">
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => onSignOut()}
                        >
                          <svg
                            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <polyline
                              points="16,17 21,12 16,7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line
                              x1="21"
                              y1="12"
                              x2="9"
                              y2="12"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Log out
                        </DropdownMenuItem>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Login for unauthenticated users */}
                      <div className="">
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => {
                            setIsDropdownOpen(false);
                            setShowAuthDialog(true);
                          }}
                        >
                          <ProfileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          Login
                        </DropdownMenuItem>
                      </div>

                      <DropdownMenuSeparator />

                      {/* Help Submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                          <QuestionCircleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1">Help</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent
                          className="w-36"
                          sideOffset={6}
                          alignOffset={-4}
                        >
                          {!isMobileFullscreen && (
                            <DropdownMenuItem
                              onSelect={() => {
                                setIsDropdownOpen(false);
                                setShortcutsDialogOpen(true);
                              }}
                              className="gap-2"
                            >
                              <KeyboardIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1">Shortcuts</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Project Selector */}
      <ProjectSelectorHeader onNewWorkspace={handleNewAgent} />

      {/* Tabs: Project / Changes */}
      <LeftSidebarTabs changesCount={changesCount} />

      {/* Tab Content */}
      {activeTab === "project" ? (
        <ProjectFileTree />
      ) : (
        <LeftSidebarChangesView />
      )}
    </div>
  );

  // Show expanded sidebar when project is selected (not just when there are changes)
  const showExpandedSidebar = !!selectedProject || hasChanges;

  return (
    <>
      {showExpandedSidebar ? sidebarContent : iconOnlySidebar}

      {/* Auth Dialog */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
}
