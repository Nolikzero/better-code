"use client";

import { PatchDiff } from "@pierre/diffs/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  Component,
  type ErrorInfo,
  forwardRef,
  memo,
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  agentsFocusedDiffFileAtom,
  type CodeSnippet,
  codeSnippetsAtomFamily,
  filteredDiffFilesAtom,
  hoveredDiffFileAtom,
  selectedDiffFilesAtom,
  toggleDiffFileSelectionAtom,
} from "../atoms";
import {
  generateSnippetId,
  getSelectionText,
  hasValidSelection,
} from "../lib/selection-utils";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

// Diff mode enum to match the old API
export enum DiffModeEnum {
  Split = 1,
  Unified = 2,
}

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Columns2,
  MessageSquarePlus,
  Rows2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "../../../components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu";
import {
  CollapseIcon,
  ExpandIcon,
  IconChatBubble,
  IconSpinner,
} from "../../../components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { getFileIconByExtension } from "../mentions";

// e2b API routes are used instead of useSandboxManager for agents
// import { useIsHydrated } from "@/hooks/use-is-hydrated"
const useIsHydrated = () => true; // Desktop is always hydrated

import {
  type ParsedDiffFile,
  parseUnifiedDiff,
} from "../../../../shared/utils";
import { useCodeTheme } from "../../../lib/hooks/use-code-theme";
import { trpcClient } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";

// Map our custom theme IDs to @pierre/diffs themes
const THEME_TO_PIERRE_MAP: Record<string, string> = {
  "default-dark": "github-dark",
  "default-light": "github",
  "claude-dark": "github-dark",
  "claude-light": "github",
  "vesper-dark": "vesper",
  "vitesse-dark": "vitesse-dark",
  "vitesse-light": "vitesse-light",
  "min-dark": "min-dark",
  "min-light": "min-light",
};

function getPierreTheme(themeId: string, isDark: boolean): string {
  if (themeId in THEME_TO_PIERRE_MAP) {
    return THEME_TO_PIERRE_MAP[themeId];
  }
  return isDark ? "github-dark" : "github";
}

// Error Boundary for DiffView to catch parsing errors
interface DiffErrorBoundaryProps {
  children: ReactNode;
  fileName: string;
}

interface DiffErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class DiffErrorBoundary extends Component<
  DiffErrorBoundaryProps,
  DiffErrorBoundaryState
> {
  constructor(props: DiffErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): DiffErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Error already captured in state, no need to log
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 p-4 text-sm text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 rounded-md">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Failed to render diff for this file. The diff format may be
            corrupted or truncated.
          </span>
        </div>
      );
    }

    return this.props.children;
  }
}

// ParsedDiffFile is imported from shared utils

export const diffViewModeAtom = atomWithStorage<DiffModeEnum>(
  "agents-diff:view-mode",
  DiffModeEnum.Unified,
);

// Re-export parseUnifiedDiff as splitUnifiedDiffByFile for backwards compatibility
export const splitUnifiedDiffByFile = parseUnifiedDiff;

interface FileDiffCardProps {
  file: ParsedDiffFile;
  isLight: boolean;
  isCollapsed: boolean;
  toggleCollapsed: (fileKey: string) => void;
  isFullExpanded: boolean;
  toggleFullExpanded: (fileKey: string) => void;
  hasContent: boolean;
  isLoadingContent: boolean;
  diffMode: DiffModeEnum;
  codeThemeId: string;
  isSelected: boolean;
  onToggleSelection: (filePath: string) => void;
}

// Custom comparator to prevent unnecessary re-renders
const fileDiffCardAreEqual = (
  prev: FileDiffCardProps,
  next: FileDiffCardProps,
): boolean => {
  // Key comparison - file identity
  if (prev.file.key !== next.file.key) return false;
  // State that affects rendering
  if (prev.isCollapsed !== next.isCollapsed) return false;
  if (prev.isFullExpanded !== next.isFullExpanded) return false;
  if (prev.hasContent !== next.hasContent) return false;
  if (prev.isLoadingContent !== next.isLoadingContent) return false;
  if (prev.diffMode !== next.diffMode) return false;
  if (prev.isLight !== next.isLight) return false;
  if (prev.codeThemeId !== next.codeThemeId) return false;
  if (prev.isSelected !== next.isSelected) return false;
  return true;
};

const FileDiffCard = memo(function FileDiffCard({
  file,
  isLight,
  isCollapsed,
  toggleCollapsed,
  isFullExpanded,
  toggleFullExpanded,
  hasContent,
  isLoadingContent,
  diffMode,
  codeThemeId,
  isSelected,
  onToggleSelection,
}: FileDiffCardProps) {
  const diffCardRef = useRef<HTMLDivElement>(null);

  // Get the theme for @pierre/diffs
  const pierreTheme = useMemo(
    () => getPierreTheme(codeThemeId, !isLight),
    [codeThemeId, isLight],
  );

  // Extract filename and directory from path
  const displayPath =
    file.newPath && file.newPath !== "/dev/null"
      ? file.newPath
      : file.oldPath && file.oldPath !== "/dev/null"
        ? file.oldPath
        : file.key;
  const fileName = displayPath.split("/").pop() || displayPath;
  const dirPath = displayPath.includes("/")
    ? displayPath.substring(0, displayPath.lastIndexOf("/"))
    : null;

  const isNewFile = file.oldPath === "/dev/null" && file.newPath;
  const isDeletedFile = file.newPath === "/dev/null" && file.oldPath;

  return (
    <div
      ref={diffCardRef}
      className="bg-background rounded-lg border border-border overflow-clip"
      data-diff-file-path={file.newPath || file.oldPath}
    >
      <header
        className={cn(
          "group px-3 py-1 font-mono text-xs bg-muted",
          // Note: sticky doesn't work with virtualization (absolute positioning)
          // Headers scroll with content like in VS Code
          "border-b transition-colors",
          "hover:bg-accent/50",
          isCollapsed ? "border-b-transparent" : "border-b-border",
        )}
      >
        <div className="flex items-center gap-3">
          {/* Checkbox for selection */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelection(displayPath);
            }}
            className={cn(
              "w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors",
              isSelected
                ? "border-primary bg-primary"
                : "border-border/50 hover:border-primary/50",
            )}
            aria-label={isSelected ? "Deselect file" : "Select file"}
          >
            {isSelected && (
              <Check className="w-3 h-3 text-primary-foreground" />
            )}
          </button>

          {/* Collapse toggle + file info (clickable area) */}
          <div
            className="flex-1 flex items-center gap-2 text-left min-w-0 min-h-[22px] cursor-pointer"
            onClick={() => toggleCollapsed(file.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCollapsed(file.key);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={!isCollapsed}
          >
            {/* Icon container with hover swap */}
            {(() => {
              const FileIcon = getFileIconByExtension(fileName);
              return (
                <div className="relative w-3.5 h-3.5 shrink-0">
                  {FileIcon && (
                    <FileIcon
                      className={cn(
                        "absolute inset-0 w-3.5 h-3.5 text-muted-foreground transition-all duration-200",
                        "group-hover:opacity-0 group-hover:scale-75",
                      )}
                    />
                  )}
                  <ChevronDown
                    className={cn(
                      "absolute inset-0 w-3.5 h-3.5 text-muted-foreground transition-all duration-200",
                      "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </div>
              );
            })()}

            {/* File name + path + status */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-medium text-foreground truncate">
                {fileName}
              </span>
              {dirPath && (
                <span className="text-muted-foreground truncate text-[11px]">
                  {dirPath}
                </span>
              )}
              {isNewFile && (
                <span className="shrink-0 text-[11px] text-emerald-600 dark:text-emerald-400">
                  (new)
                </span>
              )}
              {isDeletedFile && (
                <span className="shrink-0 text-[11px] text-red-600 dark:text-red-400">
                  (deleted)
                </span>
              )}
            </div>

            {/* Stats */}
            <span className="shrink-0 font-mono text-[11px] tabular-nums whitespace-nowrap">
              {file.additions > 0 && (
                <span className="mr-1.5 text-emerald-600 dark:text-emerald-400">
                  +{file.additions}
                </span>
              )}
              {file.deletions > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  -{file.deletions}
                </span>
              )}
            </span>
          </div>

          {/* Expand/Collapse full file button - only show if content is available */}
          {!isCollapsed && !file.isBinary && hasContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullExpanded(file.key);
                  }}
                  className={cn(
                    "shrink-0 p-1 rounded-md hover:bg-accent transition-[background-color,transform] duration-150 ease-out active:scale-95",
                    isFullExpanded && "bg-accent",
                  )}
                  aria-pressed={isFullExpanded}
                >
                  <div className="relative w-3.5 h-3.5">
                    <ExpandIcon
                      className={cn(
                        "absolute inset-0 w-3.5 h-3.5 text-muted-foreground transition-[opacity,transform] duration-200 ease-out",
                        isFullExpanded
                          ? "opacity-0 scale-75"
                          : "opacity-100 scale-100",
                      )}
                    />
                    <CollapseIcon
                      className={cn(
                        "absolute inset-0 w-3.5 h-3.5 text-muted-foreground transition-[opacity,transform] duration-200 ease-out",
                        isFullExpanded
                          ? "opacity-100 scale-100"
                          : "opacity-0 scale-75",
                      )}
                    />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isFullExpanded ? "Show changes only" : "Show full file"}
              </TooltipContent>
            </Tooltip>
          )}
          {/* Show loading spinner while content is being fetched */}
          {!isCollapsed &&
            !file.isBinary &&
            !hasContent &&
            isLoadingContent && (
              <div className="shrink-0 p-1">
                <IconSpinner className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
        </div>
      </header>

      {/* Content area */}
      {!isCollapsed && (
        <div>
          {file.isBinary ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Binary file diff can't be rendered.
            </div>
          ) : !file.isValid ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Diff format appears truncated or corrupted. Unable to render
                this file's changes.
              </span>
            </div>
          ) : (
            <div className="agent-diff-wrapper">
              <DiffErrorBoundary fileName={file.newPath || file.oldPath}>
                <PatchDiff
                  key={`${file.key}-${diffMode}`}
                  patch={file.diffText}
                  options={{
                    theme: pierreTheme,
                    diffStyle:
                      diffMode === DiffModeEnum.Split ? "split" : "unified",
                    disableFileHeader: true,
                    overflow: "scroll",
                    expandUnchanged: isFullExpanded,
                  }}
                />
              </DiffErrorBoundary>
            </div>
          )}
        </div>
      )}
    </div>
  );
}, fileDiffCardAreEqual);

interface DiffStats {
  fileCount: number;
  additions: number;
  deletions: number;
  isLoading: boolean;
  hasChanges: boolean;
}

interface AgentDiffViewProps {
  chatId: string;
  sandboxId?: string;
  /** Worktree path for local file access (desktop only) */
  worktreePath?: string;
  repository?: string;
  onStatsChange?: (stats: DiffStats) => void;
  /** Pre-loaded diff content to avoid duplicate fetch */
  initialDiff?: string | null;
  /** Pre-parsed file diffs to avoid duplicate parsing (takes precedence over initialDiff) */
  initialParsedFiles?: ParsedDiffFile[] | null;
  /** Pre-fetched file contents for instant expand (desktop only) */
  prefetchedFileContents?: Record<string, string>;
  /** Whether to show the footer with Create PR button (default: true) */
  showFooter?: boolean;
  /** Callback to create PR - if provided, used instead of internal mutation */
  onCreatePr?: () => void;
  /** Whether PR is being created (for external control) */
  isCreatingPr?: boolean;
  /** Mobile mode - shows mobile-specific header */
  isMobile?: boolean;
  /** Callback to close the diff view (for mobile back button) */
  onClose?: () => void;
  /** Callback when collapsed state changes - reports if all collapsed/all expanded */
  onCollapsedStateChange?: (state: {
    allCollapsed: boolean;
    allExpanded: boolean;
  }) => void;
}

/** Ref handle for controlling AgentDiffView from parent */
export interface AgentDiffViewRef {
  expandAll: () => void;
  collapseAll: () => void;
  isAllCollapsed: () => boolean;
  isAllExpanded: () => boolean;
}

export const AgentDiffView = forwardRef<AgentDiffViewRef, AgentDiffViewProps>(
  function AgentDiffView(
    {
      chatId,
      sandboxId,
      worktreePath,
      repository: _repository,
      onStatsChange,
      initialDiff,
      initialParsedFiles,
      prefetchedFileContents,
      showFooter: _showFooter = true,
      onCreatePr: _externalOnCreatePr,
      isCreatingPr: _externalIsCreatingPr,
      isMobile = false,
      onClose,
      onCollapsedStateChange,
    },
    ref,
  ) {
    const { resolvedTheme } = useTheme();
    const isHydrated = useIsHydrated();
    const codeThemeId = useCodeTheme();

    const [diff, setDiff] = useState<string | null>(initialDiff ?? null);
    // Loading if initialDiff not provided, or if it's null AND no parsed files (parent still loading)
    const [isLoadingDiff, setIsLoadingDiff] = useState(
      initialDiff === undefined ||
        (initialDiff === null &&
          (!initialParsedFiles || initialParsedFiles.length === 0)),
    );
    const [diffError, setDiffError] = useState<string | null>(null);
    const [collapsedByFileKey, setCollapsedByFileKey] = useState<
      Record<string, boolean>
    >({});
    const [fullExpandedByFileKey, setFullExpandedByFileKey] = useState<
      Record<string, boolean>
    >({});
    const [diffMode, setDiffMode] = useAtom(diffViewModeAtom);

    // Pre-fetched file contents for expand functionality
    // Use prefetched data if available, otherwise start empty
    const [fileContents, setFileContents] = useState<Record<string, string>>(
      prefetchedFileContents ?? {},
    );
    const [isLoadingFileContents, setIsLoadingFileContents] = useState(false);

    // Sync with prefetched file contents when they arrive after mount
    useEffect(() => {
      if (
        prefetchedFileContents &&
        Object.keys(prefetchedFileContents).length > 0
      ) {
        setFileContents(prefetchedFileContents);
      }
    }, [prefetchedFileContents]);

    // Focused file for scroll-to functionality
    const focusedDiffFile = useAtomValue(agentsFocusedDiffFileAtom);
    const setFocusedDiffFile = useSetAtom(agentsFocusedDiffFileAtom);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Code snippet context menu support
    const activeSubChatId = useAgentSubChatStore((s) => s.activeSubChatId);
    const setCodeSnippets = useSetAtom(
      codeSnippetsAtomFamily(activeSubChatId || ""),
    );
    const [hasSelection, setHasSelection] = useState(false);

    // Track selection state for context menu
    useEffect(() => {
      const handleSelectionChange = () => {
        setHasSelection(hasValidSelection());
      };
      document.addEventListener("selectionchange", handleSelectionChange);
      return () => {
        document.removeEventListener("selectionchange", handleSelectionChange);
      };
    }, []);

    // Find shadow roots inside an element and look for line numbers
    // @pierre/diffs renders content inside shadow DOM with data-line attributes
    const findLineNumbersInShadowDOM = (
      containerEl: Element,
      selectedText: string,
    ): { startLine: number; endLine: number } | null => {
      // Find all elements that might have shadow roots
      const allElements = containerEl.querySelectorAll("*");
      for (const el of Array.from(allElements)) {
        if (el.shadowRoot) {
          const shadowRoot = el.shadowRoot;
          const lineElements = shadowRoot.querySelectorAll("[data-line]");

          if (lineElements.length > 0) {
            // Try to find lines that contain parts of the selected text
            const selectedLines = selectedText.split("\n");
            const firstSelectedLine = selectedLines[0]?.trim();
            const lastSelectedLine =
              selectedLines[selectedLines.length - 1]?.trim();

            let startLine: number | null = null;
            let endLine: number | null = null;

            for (const lineEl of Array.from(lineElements)) {
              const lineText = lineEl.textContent?.trim() || "";
              const lineNum = Number.parseInt(
                lineEl.getAttribute("data-line") || "",
                10,
              );

              if (Number.isNaN(lineNum)) continue;

              // Check if this line contains our selected text
              if (
                startLine === null &&
                firstSelectedLine &&
                lineText.includes(firstSelectedLine)
              ) {
                startLine = lineNum;
              }
              if (lastSelectedLine && lineText.includes(lastSelectedLine)) {
                endLine = lineNum;
              }
            }

            if (startLine !== null) {
              return {
                startLine,
                endLine: endLine ?? startLine + selectedLines.length - 1,
              };
            }
          }
        }
      }
      return null;
    };

    // Handle adding selection to chat from diff view
    const handleAddToChat = useCallback(() => {
      const selection = window.getSelection();
      if (!selection) return;

      const text = getSelectionText(selection);
      if (!text || !activeSubChatId) return;

      // Find the file path and diff container from closest data-diff-file-path attribute
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      let filePath = "unknown";
      let language = "plaintext";
      let diffContainer: Element | null = null;

      if (range) {
        let current: Node | null = range.startContainer;
        while (current && current !== scrollContainerRef.current) {
          if (current.nodeType === Node.ELEMENT_NODE) {
            const el = current as Element;
            const path = el.getAttribute("data-diff-file-path");
            if (path) {
              filePath = path;
              diffContainer = el;
              // Guess language from extension
              const ext = path.split(".").pop()?.toLowerCase() || "";
              const langMap: Record<string, string> = {
                ts: "typescript",
                tsx: "tsx",
                js: "javascript",
                jsx: "jsx",
                py: "python",
                go: "go",
                rs: "rust",
                md: "markdown",
                json: "json",
                css: "css",
                html: "html",
              };
              language = langMap[ext] || "plaintext";
              break;
            }
          }
          current = current.parentNode;
        }
      }

      // Calculate line count from selected text
      const lines = text.split("\n");
      const lineCount = lines.length;

      // Try to find actual line numbers from shadow DOM inside the diff container
      let startLine = 1;
      let endLine = lineCount;

      if (diffContainer) {
        const lineNumbers = findLineNumbersInShadowDOM(diffContainer, text);
        if (lineNumbers) {
          startLine = lineNumbers.startLine;
          endLine = lineNumbers.endLine;
        }
      }

      const snippet: CodeSnippet = {
        id: generateSnippetId(),
        filePath,
        startLine,
        endLine,
        content: text,
        language,
      };

      setCodeSnippets((prev) => [...prev, snippet]);
      selection.removeAllRanges();
    }, [activeSubChatId, setCodeSnippets]);

    // Keyboard shortcut: Cmd+Shift+A for adding selection
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          (e.metaKey || e.ctrlKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "a"
        ) {
          if (hasValidSelection()) {
            e.preventDefault();
            handleAddToChat();
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleAddToChat]);

    // Height for collapsed header (file name + stats)
    const COLLAPSED_HEIGHT = 44;
    // Estimated height for expanded diff
    const _EXPANDED_HEIGHT_ESTIMATE = 300;

    // Fetch diff on mount (only if initialDiff not provided)
    useEffect(() => {
      // Skip fetch if initialDiff was provided with actual content or parsed files
      if (initialDiff !== undefined) {
        setDiff(initialDiff);
        // Only mark as not loading if we have actual data or explicit empty diff
        // If initialDiff is null and no parsed files, parent is still loading
        const parentStillLoading =
          initialDiff === null &&
          (!initialParsedFiles || initialParsedFiles.length === 0);
        setIsLoadingDiff(parentStillLoading);
        return;
      }

      const fetchDiff = async () => {
        // Desktop: use tRPC if no sandboxId
        if (!sandboxId && chatId) {
          try {
            setIsLoadingDiff(true);
            const result = await trpcClient.chats.getDiff.query({ chatId });
            const diffContent = result.diff || "";
            setDiff(diffContent.trim() ? diffContent : "");
          } catch (error) {
            setDiffError(
              error instanceof Error ? error.message : "Failed to fetch diff",
            );
          } finally {
            setIsLoadingDiff(false);
          }
          return;
        }

        // Web: use sandbox API
        if (!sandboxId) {
          setDiffError("Sandbox ID is required");
          setIsLoadingDiff(false);
          return;
        }

        try {
          setIsLoadingDiff(true);

          const response = await fetch(`/api/agents/sandbox/${sandboxId}/diff`);
          if (!response.ok) {
            throw new Error(`Failed to fetch diff: ${response.statusText}`);
          }

          const data = await response.json();
          const diffContent = data.diff || "";

          if (diffContent.trim()) {
            setDiff(diffContent);
          } else {
            setDiff("");
          }
        } catch (error) {
          setDiffError(
            error instanceof Error ? error.message : "Failed to fetch diff",
          );
        } finally {
          setIsLoadingDiff(false);
        }
      };

      fetchDiff();
    }, [sandboxId, chatId, initialDiff, initialParsedFiles]);

    const handleRefresh = useCallback(async () => {
      setIsLoadingDiff(true);
      setDiffError(null);

      try {
        let diffContent = "";

        // Desktop: use tRPC to get diff from worktree
        if (chatId && !sandboxId) {
          const result = await trpcClient.chats.getDiff.query({ chatId });
          diffContent = result.diff || "";
        }
        // Web: use sandbox API
        else if (sandboxId) {
          const response = await fetch(`/api/agents/sandbox/${sandboxId}/diff`);
          if (!response.ok) {
            throw new Error(`Failed to fetch diff: ${response.statusText}`);
          }
          const data = await response.json();
          diffContent = data.diff || "";
        }

        if (diffContent.trim()) {
          setDiff(diffContent);
        } else {
          setDiff("");
        }
      } catch (error) {
        setDiffError(
          error instanceof Error ? error.message : "Failed to fetch diff",
        );
      } finally {
        setIsLoadingDiff(false);
      }
    }, [chatId, sandboxId]);

    const isLight = isHydrated ? resolvedTheme !== "dark" : true;

    // Read filter for sub-chat specific file filtering
    const filteredDiffFiles = useAtomValue(filteredDiffFilesAtom);
    const setFilteredDiffFiles = useSetAtom(filteredDiffFilesAtom);

    // Clear filter when component unmounts
    useEffect(() => {
      return () => {
        setFilteredDiffFiles(null);
      };
    }, [setFilteredDiffFiles]);

    const allFileDiffs = useMemo(() => {
      // Use pre-parsed files if provided (avoids duplicate parsing)
      if (initialParsedFiles && initialParsedFiles.length > 0) {
        return initialParsedFiles;
      }
      // Fall back to parsing raw diff
      if (!diff) return [];
      try {
        return splitUnifiedDiffByFile(diff);
      } catch {
        return [];
      }
    }, [diff, initialParsedFiles]);

    // Filter files if filteredDiffFiles is set (for sub-chat Review)
    const fileDiffs = useMemo(() => {
      if (!filteredDiffFiles || filteredDiffFiles.length === 0) {
        return allFileDiffs;
      }
      // Filter to only show files matching the filter paths
      return allFileDiffs.filter((file) => {
        const filePath = file.newPath || file.oldPath;
        // Match by exact path or by path suffix (to handle sandbox path prefixes)
        return filteredDiffFiles.some(
          (filterPath) =>
            filePath === filterPath ||
            filePath.endsWith(filterPath) ||
            filterPath.endsWith(filePath),
        );
      });
    }, [allFileDiffs, filteredDiffFiles]);

    // Threshold for auto-collapsing files
    const AUTO_COLLAPSE_THRESHOLD = 10;

    // Expand/collapse all functions - exposed via ref for parent control
    // Uses batched updates to avoid blocking UI with many files
    const expandAll = useCallback(() => {
      // For small number of files, expand all at once
      if (fileDiffs.length <= 10) {
        startTransition(() => {
          const expandedState: Record<string, boolean> = {};
          for (const file of fileDiffs) {
            expandedState[file.key] = false;
          }
          setCollapsedByFileKey(expandedState);
        });
        return;
      }

      // For many files, expand in batches to avoid UI freeze
      const BATCH_SIZE = 5;
      let currentBatch = 0;

      const expandBatch = () => {
        const start = currentBatch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, fileDiffs.length);

        if (start >= fileDiffs.length) return;

        startTransition(() => {
          setCollapsedByFileKey((prev) => {
            const next = { ...prev };
            for (let i = start; i < end; i++) {
              const file = fileDiffs[i];
              if (file) next[file.key] = false;
            }
            return next;
          });
        });

        currentBatch++;
        if (currentBatch * BATCH_SIZE < fileDiffs.length) {
          // Use requestAnimationFrame for next batch to allow UI to breathe
          requestAnimationFrame(() => setTimeout(expandBatch, 0));
        }
      };

      expandBatch();
    }, [fileDiffs]);

    const collapseAll = useCallback(() => {
      // Collapse is fast - no batching needed
      startTransition(() => {
        const collapsedState: Record<string, boolean> = {};
        for (const file of fileDiffs) {
          collapsedState[file.key] = true;
        }
        setCollapsedByFileKey(collapsedState);
      });
    }, [fileDiffs]);

    // Check if all files are collapsed/expanded
    const isAllCollapsed = useCallback(() => {
      if (fileDiffs.length === 0) return true;
      return fileDiffs.every((file) => collapsedByFileKey[file.key] === true);
    }, [fileDiffs, collapsedByFileKey]);

    const isAllExpanded = useCallback(() => {
      if (fileDiffs.length === 0) return true;
      return fileDiffs.every((file) => !collapsedByFileKey[file.key]);
    }, [fileDiffs, collapsedByFileKey]);

    // Expose expand/collapse methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        expandAll,
        collapseAll,
        isAllCollapsed,
        isAllExpanded,
      }),
      [expandAll, collapseAll, isAllCollapsed, isAllExpanded],
    );

    // Notify parent when collapsed state changes
    useEffect(() => {
      onCollapsedStateChange?.({
        allCollapsed: isAllCollapsed(),
        allExpanded: isAllExpanded(),
      });
    }, [
      collapsedByFileKey,
      fileDiffs,
      onCollapsedStateChange,
      isAllCollapsed,
      isAllExpanded,
    ]);

    // Auto-collapse all files when there are many files (performance optimization)
    // Track if we've already initialized the collapsed state for this set of files
    const prevFileKeysRef = useRef<string>("");
    useEffect(() => {
      // Generate a unique key for the current file set
      const currentFileKeys = fileDiffs.map((f) => f.key).join(",");

      // Only update if the file set changed
      if (currentFileKeys !== prevFileKeysRef.current) {
        prevFileKeysRef.current = currentFileKeys;

        if (fileDiffs.length > AUTO_COLLAPSE_THRESHOLD) {
          // Collapse all files when there are many
          const collapsedState: Record<string, boolean> = {};
          for (const file of fileDiffs) {
            collapsedState[file.key] = true;
          }
          setCollapsedByFileKey(collapsedState);
        } else {
          // Reset to expanded for smaller diffs
          setCollapsedByFileKey({});
        }
      }
    }, [fileDiffs]);

    // Pre-fetch file contents when diff is loaded (for expand functionality)
    // Delayed to allow UI to render first, then fetch in background
    // Limited to prevent overwhelming the system with too many parallel requests
    const MAX_PREFETCH_FILES = 20;

    useEffect(() => {
      // Desktop: use worktreePath, Web: use sandboxId
      if (fileDiffs.length === 0 || isLoadingFileContents) return;
      if (!worktreePath && !sandboxId) return;
      // Skip if we already have enough contents
      const existingContentCount = Object.keys(fileContents).length;
      if (
        existingContentCount >= Math.min(fileDiffs.length, MAX_PREFETCH_FILES)
      )
        return;

      const fetchAllContents = async () => {
        setIsLoadingFileContents(true);

        try {
          // Limit files to prefetch to prevent overwhelming the system
          const filesToProcess = fileDiffs.slice(0, MAX_PREFETCH_FILES);

          // Build list of files to fetch (filter out /dev/null)
          const filesToFetch = filesToProcess
            .map((file) => {
              const filePath =
                file.newPath && file.newPath !== "/dev/null"
                  ? file.newPath
                  : file.oldPath;
              if (!filePath || filePath === "/dev/null") return null;
              return { key: file.key, filePath };
            })
            .filter((f): f is { key: string; filePath: string } => f !== null);

          if (filesToFetch.length === 0) {
            setIsLoadingFileContents(false);
            return;
          }

          // Desktop: use batch tRPC call
          if (worktreePath) {
            const results =
              await trpcClient.changes.readMultipleWorkingFiles.query({
                worktreePath,
                files: filesToFetch,
              });

            const newContents: Record<string, string> = {};
            for (const [key, result] of Object.entries(results)) {
              if (result.ok) {
                newContents[key] = result.content;
              }
            }
            setFileContents(newContents);
          } else if (sandboxId) {
            // Web fallback: use sandbox API (still individual calls for web)
            const results = await Promise.allSettled(
              filesToFetch.map(async ({ key, filePath }) => {
                const response = await Promise.race([
                  fetch(
                    `/api/agents/sandbox/${sandboxId}/files?path=${encodeURIComponent(filePath)}`,
                  ),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), 5000),
                  ),
                ]);
                if (!response.ok) throw new Error("Failed to fetch file");
                const data = await response.json();
                return { key, content: data.content };
              }),
            );

            const newContents: Record<string, string> = {};
            for (const result of results) {
              if (result.status === "fulfilled" && result.value?.content) {
                newContents[result.value.key] = result.value.content;
              }
            }
            setFileContents(newContents);
          }
        } catch (error) {
          console.error("Failed to prefetch file contents:", error);
        } finally {
          setIsLoadingFileContents(false);
        }
      };

      fetchAllContents();
    }, [fileDiffs, sandboxId, worktreePath]); // Note: fileContents intentionally not in deps

    const toggleFileCollapsed = useCallback((fileKey: string) => {
      setCollapsedByFileKey((prev) => ({
        ...prev,
        [fileKey]: !prev[fileKey],
      }));
    }, []);

    const toggleFileFullExpanded = useCallback((fileKey: string) => {
      setFullExpandedByFileKey((prev) => ({
        ...prev,
        [fileKey]: !prev[fileKey],
      }));
    }, []);

    // Virtualizer for efficient rendering of many files
    const virtualizer = useVirtualizer({
      count: fileDiffs.length,
      getScrollElement: () => scrollContainerRef.current,
      estimateSize: (index) => {
        const file = fileDiffs[index];
        if (!file) return COLLAPSED_HEIGHT;
        const isCollapsed = !!collapsedByFileKey[file.key];
        if (isCollapsed) {
          return COLLAPSED_HEIGHT;
        }
        // Estimate based on line count
        const lineCount = file.additions + file.deletions;
        return Math.min(Math.max(lineCount * 22 + COLLAPSED_HEIGHT, 150), 800);
      },
      overscan: 5,
    });

    const totalAdditions = fileDiffs.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = fileDiffs.reduce((sum, f) => sum + f.deletions, 0);

    // Report stats to parent
    useEffect(() => {
      onStatsChange?.({
        fileCount: fileDiffs.length,
        additions: totalAdditions,
        deletions: totalDeletions,
        isLoading: isLoadingDiff,
        hasChanges: Boolean(diff?.trim()),
      });
    }, [
      fileDiffs.length,
      totalAdditions,
      totalDeletions,
      isLoadingDiff,
      diff,
      onStatsChange,
    ]);

    // Hover state for sync with sidebar
    const [hoveredFile, setHoveredFile] = useAtom(hoveredDiffFileAtom);

    // Selection state for git operations
    const selectedFiles = useAtomValue(selectedDiffFilesAtom);
    const toggleSelection = useSetAtom(toggleDiffFileSelectionAtom);

    // Scroll to focused file when atom changes (works with virtualized list)
    useEffect(() => {
      if (!focusedDiffFile || isLoadingDiff) {
        return;
      }

      // Find the file index in the list
      let fileIndex = -1;

      // Try exact match first
      fileIndex = fileDiffs.findIndex(
        (f) => f.newPath === focusedDiffFile || f.oldPath === focusedDiffFile,
      );

      // If not found, try matching by file ending
      if (fileIndex === -1) {
        fileIndex = fileDiffs.findIndex((f) => {
          const path = f.newPath || f.oldPath || "";
          return (
            path.endsWith(focusedDiffFile) || focusedDiffFile.endsWith(path)
          );
        });
      }

      if (fileIndex >= 0) {
        // Expand the file if it's collapsed first
        const file = fileDiffs[fileIndex];
        if (file && collapsedByFileKey[file.key]) {
          setCollapsedByFileKey((prev) => ({
            ...prev,
            [file.key]: false,
          }));
        }

        // Use virtualizer's scrollToIndex for proper scrolling
        virtualizer.scrollToIndex(fileIndex, { align: "start" });

        // Add highlight effect after scroll completes
        setTimeout(() => {
          const container = scrollContainerRef.current;
          if (container) {
            const fileCard = container.querySelector(
              `[data-diff-file-path="${focusedDiffFile}"]`,
            ) as HTMLElement | null;

            if (fileCard) {
              fileCard.style.transition = "box-shadow 0.3s ease";
              fileCard.style.boxShadow =
                "0 0 0 2px hsl(var(--primary)), 0 0 12px hsl(var(--primary) / 0.3)";
              setTimeout(() => {
                fileCard.style.boxShadow = "";
              }, 1500);
            }
          }
        }, 100);
      }

      // Clear the focused file atom
      setFocusedDiffFile(null);
    }, [
      focusedDiffFile,
      isLoadingDiff,
      setFocusedDiffFile,
      fileDiffs,
      collapsedByFileKey,
    ]);

    if (!isHydrated) {
      return (
        <div className="flex h-full items-center justify-center">
          <IconSpinner className="w-6 h-6" />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex flex-col bg-background overflow-hidden min-w-0",
          isMobile ? "h-full w-full" : "h-full",
        )}
      >
        {/* Mobile Header */}
        {isMobile && (
          <div
            className="shrink-0 bg-background/95 backdrop-blur border-b h-11 min-h-[44px] max-h-[44px]"
            data-mobile-diff-header
            style={{
              // @ts-expect-error - WebKit-specific property for Electron window dragging
              WebkitAppRegion: "drag",
            }}
          >
            <div
              className="flex h-full items-center px-2 gap-2"
              style={{
                // @ts-expect-error - WebKit-specific property
                WebkitAppRegion: "no-drag",
              }}
            >
              {/* Back to chat button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shrink-0 rounded-md"
              >
                <IconChatBubble className="h-4 w-4" />
                <span className="sr-only">Back to chat</span>
              </Button>

              {/* Stats - centered */}
              <div className="flex-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                {!isLoadingDiff && fileDiffs.length > 0 && (
                  <>
                    <span className="font-mono">
                      {fileDiffs.length} file{fileDiffs.length !== 1 ? "s" : ""}
                    </span>
                    {(totalAdditions > 0 || totalDeletions > 0) && (
                      <>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{totalAdditions}
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          -{totalDeletions}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Split/Unified toggle */}
              <div className="relative bg-muted rounded-md h-7 p-0.5 flex">
                <div
                  className="absolute inset-y-0.5 rounded bg-background shadow transition-all duration-200 ease-in-out"
                  style={{
                    width: "calc(50% - 2px)",
                    left: diffMode === DiffModeEnum.Split ? "2px" : "calc(50%)",
                  }}
                />
                <button
                  onClick={() => setDiffMode(DiffModeEnum.Split)}
                  className="relative z-[2] px-1.5 flex items-center justify-center transition-colors duration-200 rounded text-muted-foreground"
                  title="Split view"
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDiffMode(DiffModeEnum.Unified)}
                  className="relative z-[2] px-1.5 flex items-center justify-center transition-colors duration-200 rounded text-muted-foreground"
                  title="Unified view"
                >
                  <Rows2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={scrollContainerRef}
              className="relative flex-1 overflow-auto p-2 select-text"
            >
              {/* Sticky cover to hide content scrolling above cards */}
              <div
                className="sticky top-0 left-0 right-0 h-0 z-20 pointer-events-none"
                aria-hidden="true"
              >
                <div className="absolute -top-2 left-0 right-0 h-2 bg-background" />
              </div>

              {/* Filter indicator when showing sub-chat files */}
              {filteredDiffFiles && filteredDiffFiles.length > 0 && (
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 mb-2 rounded-md bg-primary/10 border border-primary/20">
                  <span className="text-xs text-primary">
                    Showing {fileDiffs.length} of {allFileDiffs.length} files
                    from this chat
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilteredDiffFiles(null)}
                    className="h-5 px-2 text-xs text-primary hover:text-primary"
                  >
                    Show all
                  </Button>
                </div>
              )}

              {isLoadingDiff ||
              (isLoadingFileContents && fileDiffs.length === 0) ? (
                <div className="flex items-center justify-center h-full">
                  <IconSpinner className="w-6 h-6" />
                </div>
              ) : diffError ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <p className="text-sm text-red-500 mb-2">{diffError}</p>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    Try again
                  </Button>
                </div>
              ) : fileDiffs.length > 0 ? (
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const file = fileDiffs[virtualRow.index]!;
                    // Get display path for hover matching
                    const displayPath =
                      file.newPath && file.newPath !== "/dev/null"
                        ? file.newPath
                        : file.oldPath || "";
                    // Check if this file is hovered
                    const isFileHovered =
                      hoveredFile &&
                      (displayPath === hoveredFile ||
                        displayPath.endsWith(hoveredFile) ||
                        hoveredFile.endsWith(displayPath));

                    return (
                      <div
                        key={file.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        onMouseEnter={() => setHoveredFile(displayPath)}
                        onMouseLeave={() => setHoveredFile(null)}
                      >
                        <div
                          className={cn(
                            "pb-2 transition-all duration-150",
                            isFileHovered &&
                              "ring-2 ring-primary/50 rounded-lg",
                          )}
                        >
                          <FileDiffCard
                            file={file}
                            isLight={isLight}
                            isCollapsed={!!collapsedByFileKey[file.key]}
                            toggleCollapsed={toggleFileCollapsed}
                            isFullExpanded={!!fullExpandedByFileKey[file.key]}
                            toggleFullExpanded={toggleFileFullExpanded}
                            hasContent={!!fileContents[file.key]}
                            isLoadingContent={isLoadingFileContents}
                            diffMode={diffMode}
                            codeThemeId={codeThemeId}
                            isSelected={selectedFiles.has(displayPath)}
                            onToggleSelection={toggleSelection}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center mb-3",
                      isLight ? "bg-emerald-100" : "bg-emerald-500/10",
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        "w-5 h-5",
                        isLight ? "text-emerald-600" : "text-emerald-400",
                      )}
                    />
                  </div>
                  <p className="text-sm font-medium mb-1">
                    No changes detected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Make some changes to see the diff
                  </p>
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem
              onClick={handleAddToChat}
              disabled={!hasSelection}
              className="gap-2"
            >
              <MessageSquarePlus className="size-4" />
              <span>Add to Chat</span>
              <ContextMenuShortcut>
                {typeof navigator !== "undefined" &&
                navigator.platform.includes("Mac")
                  ? "Cmd"
                  : "Ctrl"}
                +Shift+A
              </ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  },
);
