"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { ChevronRight } from "lucide-react";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconSpinner } from "../../../components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { sessionInfoAtom } from "../../../lib/atoms";
import { api } from "../../../lib/mock-api";
import { trpc } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import { MentionTooltipContent } from "./components";
import { CATEGORY_OPTIONS, MENTION_PREFIXES } from "./constants";
import {
  createFileIconElement,
  getFileIconByExtension,
  getOptionIcon,
} from "./icons";
import type { FileMentionOption } from "./types";
import {
  formatToolName,
  matchesMultiWordSearch,
  sortFilesByRelevance,
} from "./utils";

// Re-export icon utilities for backward compatibility
export { getFileIconByExtension, createFileIconElement, getOptionIcon };

interface ChangedFile {
  filePath: string;
  displayPath: string;
  additions: number;
  deletions: number;
}

interface AgentsFileMentionProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mention: FileMentionOption) => void;
  searchText: string;
  position: { top: number; left: number };
  teamId?: string;
  repository?: string;
  sandboxId?: string;
  branch?: string; // For fetching files from specific branch via GitHub API
  projectPath?: string; // For fetching files from local project directory (desktop)
  changedFiles?: ChangedFile[]; // Files changed in current sub-chat (shown at top)
  // Subpage navigation state
  showingFilesList?: boolean;
  showingSkillsList?: boolean;
  showingAgentsList?: boolean;
  showingToolsList?: boolean;
}

// Memoized to prevent re-renders when parent re-renders
export const AgentsFileMention = memo(function AgentsFileMention({
  isOpen,
  onClose,
  onSelect,
  searchText,
  position,
  teamId,
  repository,
  sandboxId,
  branch,
  projectPath,
  changedFiles = [],
  showingFilesList = false,
  showingSkillsList = false,
  showingAgentsList = false,
  showingToolsList = false,
}: AgentsFileMentionProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const placementRef = useRef<"above" | "below" | null>(null);
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Get session info (MCP servers, tools) from atom
  const sessionInfo = useAtomValue(sessionInfoAtom);

  // Fetch skills from filesystem (cached for 5 minutes)
  const { data: skills = [], isFetching: isFetchingSkills } =
    trpc.skills.listEnabled.useQuery(undefined, {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000, // 5 minutes - skills don't change frequently
    });

  // Fetch custom agents from filesystem (cached for 5 minutes)
  const { data: customAgents = [], isFetching: isFetchingAgents } =
    trpc.agents.listEnabled.useQuery(undefined, {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000, // 5 minutes - agents don't change frequently
    });

  // Debounce search text (300ms to match canvas implementation)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // For multi-word search, send only first word to API (server filters by that),
  // then filter results on client by all words
  const apiSearchQuery = useMemo(() => {
    if (!debouncedSearchText) return "";
    const words = debouncedSearchText.split(/\s+/).filter(Boolean);
    return words[0] || "";
  }, [debouncedSearchText]);

  // Fetch files from API
  // Priority: sandboxId (includes uncommitted) > branch (GitHub API) > cached file_tree
  const {
    data: fileResults = [],
    isLoading,
    isFetching,
    error,
  } = api.github.searchFiles.useQuery(
    {
      teamId: teamId!,
      repository: repository!,
      query: apiSearchQuery,
      limit: 50,
      sandboxId: sandboxId,
      branch: branch, // Pass branch for GitHub API fetch
      projectPath: projectPath, // For local project file search (desktop)
    },
    {
      // Enable if we have projectPath (desktop) OR teamId with repository/sandboxId/branch (web)
      enabled:
        isOpen &&
        (!!projectPath ||
          (!!teamId && (!!repository || !!sandboxId || !!branch))),
      staleTime: 5000,
      refetchOnWindowFocus: false,
      // Keep showing previous results while fetching new ones
      placeholderData: keepPreviousData,
    },
  );
  // Convert changed files to options (shown at top in separate group)
  const changedFileOptions: FileMentionOption[] = useMemo(() => {
    if (!changedFiles.length) return [];

    const searchLower = debouncedSearchText.toLowerCase();

    const mapped = changedFiles
      .filter((file) =>
        // Multi-word search: all words must match in file path
        matchesMultiWordSearch(file.filePath, searchLower),
      )
      .map((file) => {
        const pathParts = file.filePath.split("/");
        const fileName = pathParts.pop() || file.filePath;
        const dirPath = pathParts.join("/") || "/";

        return {
          id: `changed:${file.filePath}`,
          label: fileName,
          path: file.filePath,
          repository: repository || "",
          truncatedPath: dirPath,
          additions: file.additions,
          deletions: file.deletions,
        };
      });

    // Sort by relevance using shared function
    return sortFilesByRelevance(mapped, debouncedSearchText);
  }, [changedFiles, debouncedSearchText, repository]);

  // Convert API results to options with truncated path
  // Exclude files that are already in changedFileOptions
  const changedFilePaths = useMemo(
    () => new Set(changedFiles.map((f) => f.filePath)),
    [changedFiles],
  );

  const repoFileOptions: FileMentionOption[] = useMemo(() => {
    const searchLower = debouncedSearchText.toLowerCase();

    const mapped = fileResults
      .filter((file) => !changedFilePaths.has(file.path))
      // Client-side multi-word filtering (API only filtered by first word)
      .filter((file) => matchesMultiWordSearch(file.path, searchLower))
      .map((file) => {
        // Get directory path (without filename/foldername) for inline display
        const pathParts = file.path.split("/");
        const dirPath = pathParts.slice(0, -1).join("/") || "/";

        return {
          id: file.id,
          label: file.label,
          path: file.path,
          repository: file.repository,
          truncatedPath: dirPath,
          type: (file as { type?: "file" | "folder" }).type,
        };
      });

    // Sort by relevance using shared function
    return sortFilesByRelevance(mapped, debouncedSearchText);
  }, [fileResults, changedFilePaths, debouncedSearchText]);

  // Convert skills to mention options
  const skillOptions: FileMentionOption[] = useMemo(() => {
    const searchLower = debouncedSearchText.toLowerCase();

    return skills
      .filter(
        (skill) =>
          // Multi-word search: all words must match in name OR description
          matchesMultiWordSearch(skill.name, searchLower) ||
          matchesMultiWordSearch(skill.description, searchLower),
      )
      .map((skill) => ({
        id: `${MENTION_PREFIXES.SKILL}${skill.name}`,
        label: skill.name,
        path: skill.path, // file path for tooltip
        repository: "",
        truncatedPath: skill.description,
        type: "skill" as const,
        // Extended data for rich tooltip
        description: skill.description,
        source: skill.source,
      }));
  }, [skills, debouncedSearchText]);

  // Convert custom agents to mention options
  const agentOptions: FileMentionOption[] = useMemo(() => {
    const searchLower = debouncedSearchText.toLowerCase();

    return customAgents
      .filter(
        (agent) =>
          // Multi-word search: all words must match in name OR description
          matchesMultiWordSearch(agent.name, searchLower) ||
          matchesMultiWordSearch(agent.description, searchLower),
      )
      .map((agent) => ({
        id: `${MENTION_PREFIXES.AGENT}${agent.name}`,
        label: agent.name,
        path: agent.path, // file path for tooltip
        repository: "",
        truncatedPath: agent.description,
        type: "agent" as const,
        // Extended data for rich tooltip
        description: agent.description,
        tools: agent.tools,
        model: agent.model,
        source: agent.source,
      }));
  }, [customAgents, debouncedSearchText]);

  // Convert MCP tools to mention options (stable, doesn't depend on search)
  // MCP tools have format like "mcp__servername__toolname"
  const allToolOptions: FileMentionOption[] = useMemo(() => {
    if (!sessionInfo?.tools || !sessionInfo?.mcpServers) return [];

    // Get connected MCP server names
    const connectedServers = new Set(
      sessionInfo.mcpServers
        .filter((s) => s.status === "connected")
        .map((s) => s.name),
    );

    // Filter tools that belong to MCP servers (format: mcp__servername__toolname)
    const mcpTools = sessionInfo.tools.filter((tool) => {
      if (!tool.startsWith("mcp__")) return false;
      const parts = tool.split("__");
      if (parts.length < 3) return false;
      const serverName = parts[1];
      return connectedServers.has(serverName);
    });

    return mcpTools.map((tool) => {
      const parts = tool.split("__");
      const serverName = parts[1];
      const toolName = parts.slice(2).join("__");
      const displayName = formatToolName(toolName);
      return {
        id: `${MENTION_PREFIXES.TOOL}${tool}`,
        label: displayName, // readable name without underscores
        path: tool, // full tool name for tooltip/mention
        repository: "",
        truncatedPath: serverName, // show server name as context
        type: "tool" as const,
        mcpServer: serverName,
      };
    });
  }, [sessionInfo]);

  // Filtered tool options based on search
  const toolOptions: FileMentionOption[] = useMemo(() => {
    if (!debouncedSearchText) return allToolOptions;

    const searchLower = debouncedSearchText.toLowerCase();
    return allToolOptions.filter((tool) => {
      // Search by: display name, raw tool name, full path, server name
      return (
        matchesMultiWordSearch(tool.label, searchLower) ||
        matchesMultiWordSearch(tool.path, searchLower) ||
        matchesMultiWordSearch(tool.mcpServer || "", searchLower)
      );
    });
  }, [allToolOptions, debouncedSearchText]);

  // Check if we have skills, agents, or tools
  // Use base data (not search-filtered) for stable category display
  const hasSkills = skills.length > 0;
  const hasAgents = customAgents.length > 0;
  const hasTools = allToolOptions.length > 0;
  const hasOnlyFiles = !hasSkills && !hasAgents && !hasTools;

  // Determine if we're in a subpage view (or showing files directly when no skills/agents/tools)
  const isInSubpage =
    showingFilesList ||
    showingSkillsList ||
    showingAgentsList ||
    showingToolsList ||
    hasOnlyFiles;

  // Filter category options based on available data
  const availableCategoryOptions = useMemo(() => {
    return CATEGORY_OPTIONS.filter((category) => {
      if (category.id === "files") return true; // Always show files
      if (category.id === "skills") return hasSkills;
      if (category.id === "agents") return hasAgents;
      if (category.id === "tools") return hasTools;
      return true;
    });
  }, [hasSkills, hasAgents, hasTools]);

  // Combined options for keyboard navigation
  // Subpage views show only that category's items
  // Root view shows changed files + category navigation options
  // Search filters globally in root view, within category in subpage
  // If no skills, agents, or tools, skip root view and show files directly
  const options: FileMentionOption[] = useMemo(() => {
    // SUBPAGE: Files (or if no skills/agents/tools, show files directly)
    if (showingFilesList || hasOnlyFiles) {
      const allFiles = [...changedFileOptions, ...repoFileOptions];
      if (debouncedSearchText) {
        return sortFilesByRelevance(allFiles, debouncedSearchText);
      }
      return allFiles;
    }

    // SUBPAGE: Skills
    if (showingSkillsList) {
      return skillOptions; // already filtered by search in skillOptions memo
    }

    // SUBPAGE: Agents
    if (showingAgentsList) {
      return agentOptions; // already filtered by search in agentOptions memo
    }

    // SUBPAGE: MCP Tools
    if (showingToolsList) {
      return toolOptions; // already filtered by search in toolOptions memo
    }

    // ROOT VIEW
    if (debouncedSearchText) {
      // Global search: search across changed files + categories + skills + agents + tools + repo files
      const searchLower = debouncedSearchText.toLowerCase();
      const filteredCategories = availableCategoryOptions.filter((c) =>
        c.label.toLowerCase().includes(searchLower),
      );
      const allItems = [
        ...changedFileOptions,
        ...filteredCategories,
        ...skillOptions,
        ...agentOptions,
        ...toolOptions,
        ...repoFileOptions,
      ];
      return sortFilesByRelevance(allItems, debouncedSearchText);
    }

    // No search: Changed files FIRST (quick access), then category navigation
    return [...changedFileOptions, ...availableCategoryOptions];
  }, [
    showingFilesList,
    showingSkillsList,
    showingAgentsList,
    showingToolsList,
    debouncedSearchText,
    changedFileOptions,
    repoFileOptions,
    skillOptions,
    agentOptions,
    toolOptions,
    hasOnlyFiles,
    availableCategoryOptions,
  ]);

  // Track previous values for smarter selection reset
  const prevIsOpenRef = useRef(isOpen);
  const prevSearchRef = useRef(debouncedSearchText);
  const prevShowingFilesListRef = useRef(showingFilesList);
  const prevShowingSkillsListRef = useRef(showingSkillsList);
  const prevShowingAgentsListRef = useRef(showingAgentsList);
  const prevShowingToolsListRef = useRef(showingToolsList);

  // CONSOLIDATED: Single useLayoutEffect for selection management (was 3 separate)
  useLayoutEffect(() => {
    const didJustOpen = isOpen && !prevIsOpenRef.current;
    const didSearchChange = debouncedSearchText !== prevSearchRef.current;
    const didSubpageChange =
      showingFilesList !== prevShowingFilesListRef.current ||
      showingSkillsList !== prevShowingSkillsListRef.current ||
      showingAgentsList !== prevShowingAgentsListRef.current ||
      showingToolsList !== prevShowingToolsListRef.current;

    // Reset to 0 when opening, search changes, or subpage changes
    if (didJustOpen || didSearchChange || didSubpageChange) {
      setSelectedIndex(0);
    }
    // Clamp to valid range if options shrunk
    else if (options.length > 0 && selectedIndex >= options.length) {
      setSelectedIndex(Math.max(0, options.length - 1));
    }

    // Update refs
    prevIsOpenRef.current = isOpen;
    prevSearchRef.current = debouncedSearchText;
    prevShowingFilesListRef.current = showingFilesList;
    prevShowingSkillsListRef.current = showingSkillsList;
    prevShowingAgentsListRef.current = showingAgentsList;
    prevShowingToolsListRef.current = showingToolsList;
  }, [
    isOpen,
    debouncedSearchText,
    options.length,
    selectedIndex,
    showingFilesList,
    showingSkillsList,
    showingAgentsList,
    showingToolsList,
  ]);

  // Reset placement when closed
  useEffect(() => {
    if (!isOpen) {
      placementRef.current = null;
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSelectedIndex((prev) => (prev + 1) % options.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSelectedIndex(
            (prev) => (prev - 1 + options.length) % options.length,
          );
          break;
        case "Enter":
          if (e.shiftKey) return;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (options[selectedIndex]) {
            onSelect(options[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, options, selectedIndex, onSelect, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    // Account for header element
    const headerOffset = 1;
    if (selectedIndex === 0) {
      dropdownRef.current.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const elements = dropdownRef.current.querySelectorAll(
      "[data-option-index]",
    );
    const selectedElement = elements[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isOpen]);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate dropdown dimensions (matching canvas style)
  // Narrower dropdown when showing only categories (no changed files)
  const hasChangedFiles = changedFileOptions.length > 0;
  const isRootView =
    !showingFilesList &&
    !showingSkillsList &&
    !showingAgentsList &&
    !showingToolsList &&
    !hasOnlyFiles;
  // Narrow dropdown for root view (categories only) and skills/agents/tools subpages
  // Wide dropdown for files (showingFilesList or hasOnlyFiles)
  const useNarrowWidth =
    (isRootView && !hasChangedFiles && !debouncedSearchText) ||
    showingSkillsList ||
    showingAgentsList ||
    showingToolsList;
  const dropdownWidth = useNarrowWidth ? 200 : 320;
  const itemHeight = 28;
  const headerHeight = 28; // header with py-1.5 and text-xs
  // Only add header height when header is actually shown (in subpages or when searching)
  const showsHeader = !isRootView || !!debouncedSearchText;
  const paddingHeight = 8; // py-1 on container = 4px top + 4px bottom
  const requestedHeight = Math.min(
    options.length * itemHeight +
      (showsHeader ? headerHeight : 0) +
      paddingHeight,
    200,
  );
  const gap = 8;

  // Decide placement like Radix Popover (auto-flip top/bottom)
  const safeMargin = 10;
  const caretOffsetBelow = 20; // small offset so list doesn't overlap caret line
  const availableBelow =
    window.innerHeight - (position.top + caretOffsetBelow) - safeMargin;
  const availableAbove = position.top - safeMargin;

  // Compute desired placement, but lock it for the duration of the open state
  // Prefer above if there's more space above, or if below doesn't fit
  if (placementRef.current === null) {
    const condition1 =
      availableAbove >= requestedHeight && availableBelow < requestedHeight;
    const condition2 =
      availableAbove > availableBelow && availableAbove >= requestedHeight;
    const shouldPlaceAbove = condition1 || condition2;
    placementRef.current = shouldPlaceAbove ? "above" : "below";
  }
  const placeAbove = placementRef.current === "above";

  // Compute final top based on placement
  const finalTop = placeAbove
    ? position.top - gap
    : position.top + gap + caretOffsetBelow;

  // Slight left bias to better align with '@'
  const leftOffset = -4;
  let finalLeft = position.left + leftOffset;

  // Adjust horizontal overflow
  if (finalLeft + dropdownWidth > window.innerWidth - safeMargin) {
    finalLeft = window.innerWidth - dropdownWidth - safeMargin;
  }
  if (finalLeft < safeMargin) {
    finalLeft = safeMargin;
  }

  // Compute actual maxHeight based on available space on the chosen side
  const computedMaxHeight = Math.max(
    80,
    Math.min(
      requestedHeight,
      placeAbove ? availableAbove - gap : availableBelow - gap,
    ),
  );
  const transformY = placeAbove ? "translateY(-100%)" : "translateY(0)";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={dropdownRef}
        className="fixed z-[99999] overflow-hidden rounded-sm border border-border bg-popover py-1 text-xs text-popover-foreground shadow-lg dark"
        style={{
          top: finalTop,
          left: finalLeft,
          width: `${dropdownWidth}px`,
          maxHeight: `${computedMaxHeight}px`,
          overflowY: "auto",
          transform: transformY,
        }}
      >
        {/* Initial loading state (no previous data) */}
        {isLoading && options.length === 0 && (
          <div className="flex items-center gap-1.5 h-7 px-1.5 mx-1 text-xs text-muted-foreground">
            <IconSpinner className="h-3.5 w-3.5" />
            <span>Loading files...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="h-7 px-1.5 mx-1 flex items-center text-xs text-muted-foreground">
            Error loading files
          </div>
        )}

        {/* Empty state (only show when not fetching) */}
        {!isLoading && !isFetching && !error && options.length === 0 && (
          <div className="h-7 px-1.5 mx-1 flex items-center text-xs text-muted-foreground">
            {debouncedSearchText
              ? `No files matching "${debouncedSearchText}"`
              : "No files found"}
          </div>
        )}

        {/* File list */}
        {!isLoading && !error && options.length > 0 && (
          <>
            {/* Flat list sorted by relevance */}
            <>
              {/* Header - only show in subpages or when searching, not in root view */}
              {(isInSubpage || debouncedSearchText) && (
                <div className="px-2.5 py-1.5 mx-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span>
                    {showingFilesList || hasOnlyFiles
                      ? "Files & Folders"
                      : showingSkillsList
                        ? "Skills"
                        : showingAgentsList
                          ? "Agents"
                          : showingToolsList
                            ? "MCP Tools"
                            : "Results"}
                  </span>
                  {isFetching && !isLoading && (
                    <IconSpinner className="h-2.5 w-2.5" />
                  )}
                </div>
              )}
              {options.map((option, index) => {
                const isSelected = selectedIndex === index;
                const OptionIcon = getOptionIcon(option);
                const isCategory = option.type === "category";
                const showTooltip = !isCategory && option.path;

                const itemContent = (
                  <div
                    data-option-index={index}
                    onClick={() => onSelect(option)}
                    onMouseEnter={() => {
                      setHoverIndex(index);
                      setSelectedIndex(index);
                    }}
                    onMouseLeave={() => {
                      setHoverIndex((prev) => (prev === index ? null : prev));
                    }}
                    className={cn(
                      "group inline-flex w-[calc(100%-8px)] mx-1 items-center whitespace-nowrap outline-none",
                      "h-7 px-1.5 justify-start text-xs rounded-md",
                      "transition-colors cursor-pointer select-none gap-1.5",
                      isSelected
                        ? "dark:bg-neutral-800 bg-accent text-foreground"
                        : "text-muted-foreground dark:hover:bg-neutral-800 hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <OptionIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="flex items-center gap-1 w-full min-w-0">
                      <span
                        className={cn(
                          "shrink-0 whitespace-nowrap",
                          isCategory && "font-medium",
                        )}
                      >
                        {option.label}
                      </span>
                      {/* Diff stats for changed files */}
                      {(option.additions || option.deletions) && (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono">
                          {option.additions ? (
                            <span className="text-green-500">
                              +{option.additions}
                            </span>
                          ) : null}
                          {option.deletions ? (
                            <span className="text-red-500">
                              -{option.deletions}
                            </span>
                          ) : null}
                        </span>
                      )}
                      {/* Show truncated path for files only, not for skills/agents (they show in tooltip) */}
                      {option.truncatedPath &&
                        !isCategory &&
                        option.type !== "skill" &&
                        option.type !== "agent" && (
                          <span
                            className="text-muted-foreground flex-1 min-w-0 ml-2 font-mono overflow-hidden text-[10px]"
                            style={{
                              direction: "rtl",
                              textAlign: "left",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ direction: "ltr" }}>
                              {option.truncatedPath}
                            </span>
                          </span>
                        )}
                    </span>
                    {/* ChevronRight for category items (navigate to subpage) */}
                    {isCategory && (
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                );

                if (showTooltip) {
                  return (
                    <Tooltip key={option.id} open={isSelected}>
                      <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
                      <TooltipContent
                        side="left"
                        align="start"
                        sideOffset={8}
                        collisionPadding={16}
                        avoidCollisions
                        className="overflow-hidden"
                      >
                        <MentionTooltipContent option={option} />
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={option.id}>{itemContent}</div>;
              })}
            </>
          </>
        )}
      </div>
    </TooltipProvider>
  );
});
