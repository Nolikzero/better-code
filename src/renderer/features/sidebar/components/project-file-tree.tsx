"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronsDownUp, ChevronRight, FolderOpen, MessageSquarePlus } from "lucide-react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { OpenInContextMenu } from "../../../components/open-in-context-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu";
import { FilesIcon } from "../../../components/ui/icons";
import { api } from "../../../lib/mock-api";
import { trpc, trpcClient } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import {
  centerFilePathAtom,
  expandedFoldersAtomFamily,
  mainContentActiveTabAtom,
  pendingFileMentionsAtom,
  revealFileInTreeAtom,
  selectedAgentChatIdAtom,
  selectedProjectAtom,
} from "../../agents/atoms";
import { getFileIconByExtension } from "../../agents/mentions/icons/file-icons";
import { FolderClosedIcon } from "../../agents/mentions/icons/folder-icons";
import type { FileMentionOption } from "../../agents/mentions/types";

interface FileTreeEntry {
  name: string;
  path: string;
  type: "file" | "folder";
  isHidden: boolean;
}

interface TreeNode {
  entry: FileTreeEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  children?: TreeNode[];
}

/**
 * Get all parent folder paths for a file path
 * e.g., "src/lib/utils.ts" -> ["src", "src/lib"]
 */
function getParentFolderPaths(filePath: string): string[] {
  const parts = filePath.split("/").filter(Boolean);
  const parents: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    parents.push(parts.slice(0, i + 1).join("/"));
  }
  return parents;
}

interface TreeItemRowProps {
  node: TreeNode;
  virtualStart: number;
  virtualSize: number;
  isActive: boolean;
  isHighlighted: boolean;
  onToggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  onDragStart: (e: React.DragEvent, entry: FileTreeEntry) => void;
}

const TreeItemRow = memo(function TreeItemRow({
  node,
  virtualStart,
  virtualSize,
  isActive,
  isHighlighted,
  onToggleFolder,
  onFileClick,
  onDragStart,
}: TreeItemRowProps) {
  const { entry, depth, isExpanded, isLoading } = node;
  const isFolder = entry.type === "folder";
  const FileIcon = isFolder
    ? null
    : getFileIconByExtension(entry.name) || FilesIcon;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: `${virtualSize}px`,
        transform: `translateY(${virtualStart}px)`,
      }}
    >
      <button
        data-entry-path={entry.path}
        onClick={() =>
          isFolder ? onToggleFolder(entry.path) : onFileClick(entry.path)
        }
        draggable
        onDragStart={(e) => onDragStart(e, entry)}
        className={cn(
          "w-full h-full flex items-center gap-2 px-3 text-left text-sm",
          "hover:bg-muted/50 transition-colors duration-300",
          "focus:outline-none focus:bg-muted/50",
          isActive && !isHighlighted && "bg-accent/50",
          isHighlighted && "bg-primary/15 border-l-2 border-primary",
        )}
        style={{
          paddingLeft: `${12 + depth * 16}px`,
        }}
      >
        {isFolder ? (
          <>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-foreground/70" />
            ) : (
              <FolderClosedIcon className="h-4 w-4 shrink-0 text-foreground/70" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            {FileIcon && (
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </>
        )}

        <span
          className={cn(
            "truncate min-w-0 text-xs font-medium",
            "text-foreground",
          )}
        >
          {entry.name}
        </span>

        {isLoading && (
          <span className="ml-auto shrink-0">
            <span className="animate-spin inline-block w-3 h-3 border border-muted-foreground/30 border-t-muted-foreground rounded-full" />
          </span>
        )}
      </button>
    </div>
  );
});

export function ProjectFileTree() {
  const selectedProject = useAtomValue(selectedProjectAtom);
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom);
  const { data: agentChat } = api.agents.getAgentChat.useQuery(
    { chatId: selectedChatId! },
    { enabled: !!selectedChatId },
  );

  // Use worktree path if set, otherwise project path
  const browsePath = agentChat?.worktreePath || selectedProject?.path;

  const [expandedFolders, setExpandedFolders] = useAtom(
    expandedFoldersAtomFamily(browsePath ?? ""),
  );
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const [centerFilePath, setCenterFilePath] = useAtom(centerFilePathAtom);
  const [revealFilePath, setRevealFilePath] = useAtom(revealFileInTreeAtom);
  const setPendingFileMentions = useSetAtom(pendingFileMentionsAtom);
  const parentRef = useRef<HTMLDivElement>(null);
  const subscriberId = useId();

  // Time-based debounce to prevent double-toggle (e.g., from React StrictMode or rapid clicks)
  const lastToggleTimeRef = useRef<Record<string, number>>({});

  // Track which folders are currently loading
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  // Cache for loaded directory contents
  const [directoryCache, setDirectoryCache] = useState<
    Record<string, FileTreeEntry[]>
  >({});

  // Highlighted file for reveal effect
  const [highlightedFilePath, setHighlightedFilePath] = useState<string | null>(
    null,
  );

  // Fetch root directory contents
  const {
    data: rootEntries,
    isLoading: isLoadingRoot,
    refetch: refetchRoot,
  } = trpc.files.listDirectory.useQuery(
    {
      projectPath: browsePath ?? "",
      relativePath: "",
      showHidden: false,
    },
    {
      enabled: !!browsePath,
      staleTime: 5000,
    },
  );

  // Subscribe to file changes for auto-refresh
  trpc.files.watchDirectory.useSubscription(
    {
      directoryPath: browsePath ?? "",
      subscriberId,
    },
    {
      enabled: !!browsePath,
      onData: (event) => {
        // Handle directory change event
        const { type, relativePath } = event;

        // If it's a root-level change, refetch root
        if (!relativePath.includes("/") && !relativePath.includes("\\")) {
          refetchRoot();
        }

        // Get the parent directory of the changed file/folder
        const parentPath = relativePath.includes("/")
          ? relativePath.substring(0, relativePath.lastIndexOf("/"))
          : relativePath.includes("\\")
            ? relativePath.substring(0, relativePath.lastIndexOf("\\"))
            : "";

        // Invalidate the cache for affected directories
        if (
          type === "add" ||
          type === "addDir" ||
          type === "unlink" ||
          type === "unlinkDir"
        ) {
          // Invalidate root if parent is empty
          if (parentPath === "") {
            refetchRoot();
          } else {
            // Invalidate the parent directory cache
            setDirectoryCache((prev) => {
              const newCache = { ...prev };
              delete newCache[parentPath];
              return newCache;
            });
            // Also invalidate the item itself if it was a directory
            if (type === "unlinkDir" || type === "addDir") {
              setDirectoryCache((prev) => {
                const newCache = { ...prev };
                delete newCache[relativePath];
                return newCache;
              });
            }
          }
        }
      },
      onError: (error) => {
        console.error("[ProjectFileTree] Watch error:", error);
      },
    },
  );

  // Build flattened tree structure (recalculates only when structure changes)
  const flattenedStructure = useMemo(() => {
    if (!rootEntries) return [];

    const result: { entry: FileTreeEntry; depth: number; isExpanded: boolean }[] = [];
    const MAX_DEPTH = 50;

    const addEntries = (
      entries: FileTreeEntry[],
      depth: number,
      visited: Set<string>,
    ) => {
      if (depth > MAX_DEPTH) return;

      for (const entry of entries) {
        const isExpanded = expandedFolders.has(entry.path);
        const cachedChildren = directoryCache[entry.path];
        const expanded = entry.type === "folder" && isExpanded;

        result.push({ entry, depth, isExpanded: expanded });

        // If folder is expanded and has cached children, add them (skip if already visited)
        if (expanded && cachedChildren && !visited.has(entry.path)) {
          visited.add(entry.path);
          addEntries(cachedChildren, depth + 1, visited);
        }
      }
    };

    addEntries(rootEntries, 0, new Set());
    return result;
  }, [rootEntries, expandedFolders, directoryCache]);

  // Derive full TreeNode[] with loading state (cheap — doesn't trigger structure recalc)
  const flattenedTree: TreeNode[] = useMemo(
    () =>
      flattenedStructure.map((node) => ({
        ...node,
        isLoading: loadingFolders.has(node.entry.path),
      })),
    [flattenedStructure, loadingFolders],
  );

  // Virtualizer for efficient rendering of large trees
  const virtualizer = useVirtualizer({
    count: flattenedTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 10,
  });

  // Handle folder expand/collapse
  const handleToggleFolder = useCallback(
    async (folderPath: string) => {
      // Time-based debounce to prevent double-toggle
      const now = Date.now();
      const lastToggle = lastToggleTimeRef.current[folderPath] || 0;
      if (now - lastToggle < 150) {
        return;
      }
      lastToggleTimeRef.current[folderPath] = now;

      // Check current state synchronously before startTransition
      // (startTransition defers execution, so we can't read mutated locals after it)
      const isCurrentlyExpanded = expandedFolders.has(folderPath);
      const isExpanding = !isCurrentlyExpanded;

      // Wrap in startTransition to keep UI responsive during large tree recalculations
      startTransition(() => {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          if (isCurrentlyExpanded) {
            next.delete(folderPath);
          } else {
            next.add(folderPath);
          }
          return next;
        });
      });

      // Load directory contents if not cached and we're expanding
      if (isExpanding && !directoryCache[folderPath] && browsePath) {
        setLoadingFolders((prev) => new Set(prev).add(folderPath));

        try {
          const entries = await trpcClient.files.listDirectory.query({
            projectPath: browsePath,
            relativePath: folderPath,
            showHidden: false,
          });

          if (entries) {
            setDirectoryCache((prev) => ({
              ...prev,
              [folderPath]: entries as FileTreeEntry[],
            }));
          }
        } catch (error) {
          console.error("Failed to load directory:", error);
        } finally {
          setLoadingFolders((prev) => {
            const next = new Set(prev);
            next.delete(folderPath);
            return next;
          });
        }
      }
    },
    [expandedFolders, setExpandedFolders, directoryCache, browsePath],
  );

  // Handle file click - open in center view
  const handleFileClick = useCallback(
    (filePath: string) => {
      setCenterFilePath(filePath);
      setActiveTab("file");
    },
    [setCenterFilePath, setActiveTab],
  );

  // Create a FileMentionOption from a file/folder entry
  const createMentionOption = useCallback(
    (entry: FileTreeEntry): FileMentionOption => {
      const isFolder = entry.type === "folder";
      const fileName = entry.name;
      return {
        id: `${isFolder ? "folder" : "file"}:local:${entry.path}`,
        label: fileName,
        path: entry.path,
        repository: "local",
        truncatedPath: entry.path.includes("/")
          ? entry.path.substring(0, entry.path.lastIndexOf("/"))
          : "",
        type: isFolder ? "folder" : "file",
      };
    },
    [],
  );

  // Handle "Add to Chat" context menu action
  const handleAddToChat = useCallback(
    (entry: FileTreeEntry) => {
      const mention = createMentionOption(entry);
      setPendingFileMentions((prev) => [...prev, mention]);
    },
    [createMentionOption, setPendingFileMentions],
  );

  // Handle drag start - set file mention data
  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: FileTreeEntry) => {
      const mention = createMentionOption(entry);
      const mentionJson = JSON.stringify(mention);
      // Use text/plain with prefix for better compatibility in Electron
      e.dataTransfer.setData("text/plain", `__FILE_MENTION__${mentionJson}`);
      // Also set custom type as backup
      e.dataTransfer.setData("application/x-file-mention", mentionJson);
      e.dataTransfer.effectAllowed = "copy";
    },
    [createMentionOption],
  );

  const handleCollapseAll = useCallback(() => {
    setExpandedFolders(new Set());
  }, [setExpandedFolders]);

  const hasExpandedFolders = expandedFolders.size > 0;

  // Track which entry was right-clicked for the shared context menu
  const [contextMenuEntry, setContextMenuEntry] =
    useState<FileTreeEntry | null>(null);

  // Handle right-click on the tree container to identify which item was clicked
  const handleTreeContextMenu = useCallback(
    (e: React.MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target !== e.currentTarget) {
        const entryPath = target.dataset.entryPath;
        if (entryPath) {
          const node = flattenedTree.find((n) => n.entry.path === entryPath);
          if (node) {
            setContextMenuEntry(node.entry);
          }
          return; // Let Radix handle the context menu opening
        }
        target = target.parentElement;
      }
      // No tree item found — prevent the context menu from appearing
      e.preventDefault();
    },
    [flattenedTree],
  );

  // Clear cache when browse path changes (project or worktree change)
  useEffect(() => {
    setDirectoryCache({});
    setLoadingFolders(new Set());
  }, [browsePath]);

  // Load contents for folders that are expanded but not cached (e.g., on page reload)
  useEffect(() => {
    if (!browsePath || !rootEntries) return;

    const loadExpandedFolders = async () => {
      // Find expanded folders that don't have cached contents
      const foldersToLoad = [...expandedFolders].filter(
        (folderPath) => !directoryCache[folderPath],
      );

      if (foldersToLoad.length === 0) return;

      // Mark all as loading
      setLoadingFolders((prev) => {
        const next = new Set(prev);
        for (const path of foldersToLoad) {
          next.add(path);
        }
        return next;
      });

      try {
        // Batch-load all directories in a single call
        const results = await trpcClient.files.batchListDirectories.query({
          projectPath: browsePath,
          relativePaths: foldersToLoad,
          showHidden: false,
        });

        const newCache: Record<string, FileTreeEntry[]> = {};
        for (const [folderPath, entries] of Object.entries(results)) {
          if (entries) {
            newCache[folderPath] = entries as FileTreeEntry[];
          }
        }

        if (Object.keys(newCache).length > 0) {
          setDirectoryCache((prev) => ({ ...prev, ...newCache }));
        }
      } catch (error) {
        console.error("Failed to batch-load directories:", error);
      }

      // Clear loading state
      setLoadingFolders((prev) => {
        const next = new Set(prev);
        for (const path of foldersToLoad) {
          next.delete(path);
        }
        return next;
      });
    };

    loadExpandedFolders();
    // Note: directoryCache intentionally excluded to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browsePath, rootEntries, expandedFolders]);

  // Reveal file in tree when revealFilePath is set (from QuickOpenDialog)
  useEffect(() => {
    if (!revealFilePath || !browsePath || !rootEntries) return;

    const revealFile = async () => {
      // Get parent folder paths
      const parentPaths = getParentFolderPaths(revealFilePath);

      // Find which folders need to be expanded
      const foldersToExpand = parentPaths.filter(
        (path) => !expandedFolders.has(path),
      );

      // Expand all parent folders
      if (foldersToExpand.length > 0) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          for (const p of foldersToExpand) {
            next.add(p);
          }
          return next;
        });

        // Load directory contents for new expanded folders
        const foldersToLoad = foldersToExpand.filter(
          (path) => !directoryCache[path],
        );

        if (foldersToLoad.length > 0) {
          setLoadingFolders((prev) => {
            const next = new Set(prev);
            for (const p of foldersToLoad) {
              next.add(p);
            }
            return next;
          });

          try {
            const results = await trpcClient.files.batchListDirectories.query({
              projectPath: browsePath,
              relativePaths: foldersToLoad,
              showHidden: false,
            });

            const newCache: Record<string, FileTreeEntry[]> = {};
            for (const [folderPath, entries] of Object.entries(results)) {
              if (entries) {
                newCache[folderPath] = entries as FileTreeEntry[];
              }
            }

            if (Object.keys(newCache).length > 0) {
              setDirectoryCache((prev) => ({ ...prev, ...newCache }));
            }
          } catch (error) {
            console.error("Failed to batch-load directories for reveal:", error);
          }

          setLoadingFolders((prev) => {
            const next = new Set(prev);
            for (const p of foldersToLoad) {
              next.delete(p);
            }
            return next;
          });
        }
      }

      // Wait for next render cycle to ensure flattenedTree is updated
      requestAnimationFrame(() => {
        // Find file index in flattened tree
        const fileIndex = flattenedTree.findIndex(
          (node) => node.entry.path === revealFilePath,
        );

        if (fileIndex >= 0) {
          // Scroll to file
          virtualizer.scrollToIndex(fileIndex, { align: "center" });

          // Set highlight
          setHighlightedFilePath(revealFilePath);

          // Clear highlight after 2s
          setTimeout(() => {
            setHighlightedFilePath(null);
          }, 2000);
        }

        // Clear reveal atom
        setRevealFilePath(null);
      });
    };

    revealFile();
    // Note: flattenedTree, directoryCache, expandedFolders intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealFilePath, browsePath, rootEntries, virtualizer]);

  if (!selectedProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground text-sm text-center">
        Select a project to browse files
      </div>
    );
  }

  if (isLoadingRoot) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (!rootEntries || rootEntries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground text-sm text-center">
        No files found
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Project tree
        </span>
        {hasExpandedFolders && (
          <button
            onClick={handleCollapseAll}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Collapse all"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={parentRef}
          className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          onContextMenu={handleTreeContextMenu}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const node = flattenedTree[virtualItem.index];
              if (!node) return null;

              return (
                <TreeItemRow
                  key={node.entry.path}
                  node={node}
                  virtualStart={virtualItem.start}
                  virtualSize={virtualItem.size}
                  isActive={centerFilePath === node.entry.path}
                  isHighlighted={highlightedFilePath === node.entry.path}
                  onToggleFolder={handleToggleFolder}
                  onFileClick={handleFileClick}
                  onDragStart={handleDragStart}
                />
              );
            })}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={() => contextMenuEntry && handleAddToChat(contextMenuEntry)}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Add to Chat
        </ContextMenuItem>
        {browsePath && contextMenuEntry && (
          <>
            <ContextMenuSeparator />
            <OpenInContextMenu
              path={`${browsePath.replace(/\/+$/, "")}/${contextMenuEntry.path.replace(/^\/+/, "")}`}
            />
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
    </div>
  );
}
