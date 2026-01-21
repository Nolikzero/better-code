/**
 * Quick Open Dialog - VS Code-style file search with Cmd+P
 * Optimized for instant performance with debouncing and virtualization
 */

import { useVirtualizer } from "@tanstack/react-virtual";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FileText, Folder } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  centerFileLineAtom,
  centerFilePathAtom,
  mainContentActiveTabAtom,
  revealFileInTreeAtom,
  selectedAgentChatIdAtom,
  selectedProjectAtom,
} from "../../features/agents/atoms";
import { getFileIconByExtension } from "../../features/agents/mentions/icons/file-icons";
import { FolderClosedIcon } from "../../features/agents/mentions/icons/folder-icons";
import { quickOpenDialogOpenAtom } from "../../lib/atoms";
import { api } from "../../lib/mock-api";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Dialog, DialogContent } from "./dialog";

interface FileEntry {
  id: string;
  label: string;
  path: string;
  type: "file" | "folder";
}

const ITEM_HEIGHT = 36;
const OVERSCAN = 5;
const MAX_VISIBLE_ITEMS = 12;
const DEBOUNCE_MS = 80;

/**
 * Parse query for line number syntax
 * Supports: "filename:123" or ":123" (go to line in current file)
 */
function parseQueryWithLine(query: string): {
  searchQuery: string;
  lineNumber: number | null;
  isGoToLine: boolean;
} {
  // Check for `:123` at end of query or standalone
  const match = query.match(/^(.*):(\d+)$/);
  if (match) {
    const searchPart = match[1].trim();
    const line = parseInt(match[2], 10);
    return {
      searchQuery: searchPart,
      lineNumber: line,
      isGoToLine: searchPart === "",
    };
  }

  // Handle intermediate state: "filename:" (colon but no digits yet)
  // Strip trailing colon so search still works while user is typing line number
  if (query.endsWith(":")) {
    return {
      searchQuery: query.slice(0, -1).trim(),
      lineNumber: null,
      isGoToLine: false,
    };
  }

  return { searchQuery: query, lineNumber: null, isGoToLine: false };
}

export function QuickOpenDialog() {
  const [isOpen, setIsOpen] = useAtom(quickOpenDialogOpenAtom);
  const selectedProject = useAtomValue(selectedProjectAtom);
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom);
  const setCenterFilePath = useSetAtom(centerFilePathAtom);
  const setCenterFileLine = useSetAtom(centerFileLineAtom);
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const setRevealFileInTree = useSetAtom(revealFileInTreeAtom);

  // Get agent chat to check for worktree path
  const { data: agentChat } = api.agents.getAgentChat.useQuery(
    { chatId: selectedChatId! },
    { enabled: !!selectedChatId },
  );

  // Use worktree path if set, otherwise project path (same as project-file-tree.tsx)
  const browsePath = agentChat?.worktreePath || selectedProject?.path;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Parse query for line number syntax (e.g., "file.ts:42" or ":100")
  const parsedQuery = useMemo(() => parseQueryWithLine(query), [query]);
  const parsedDebouncedQuery = useMemo(
    () => parseQueryWithLine(debouncedQuery),
    [debouncedQuery],
  );

  // Debounce search query for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      // Focus input after dialog animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch files with tRPC - use browsePath (worktree or project)
  // Use parsed search query (strips line number suffix)
  const { data: files = [], isLoading } = trpc.files.search.useQuery(
    {
      projectPath: browsePath ?? "",
      query: parsedDebouncedQuery.searchQuery,
      limit: 100,
    },
    {
      enabled: isOpen && !!browsePath && !parsedDebouncedQuery.isGoToLine,
      staleTime: 5000, // Use cached data for 5s
      refetchOnWindowFocus: false,
    },
  );

  // Memoize filtered results
  const filteredFiles = useMemo(() => {
    return files as FileEntry[];
  }, [files]);

  // Clamp selected index when results change
  useEffect(() => {
    if (selectedIndex >= filteredFiles.length) {
      setSelectedIndex(Math.max(0, filteredFiles.length - 1));
    }
  }, [filteredFiles.length, selectedIndex]);

  // Virtual list for performance
  const rowVirtualizer = useVirtualizer({
    count: filteredFiles.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  // Handle file selection
  const handleSelect = useCallback(
    (file: FileEntry, lineNumber: number | null = null) => {
      if (file.type === "file") {
        setCenterFilePath(file.path);
        setCenterFileLine(lineNumber);
        setActiveTab("file");
        setRevealFileInTree(file.path); // Reveal in project tree
        setIsOpen(false);
      }
      // For folders, we could expand them in the file tree
      // For now, just close the dialog
    },
    [
      setCenterFilePath,
      setCenterFileLine,
      setActiveTab,
      setRevealFileInTree,
      setIsOpen,
    ],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Tab completion works even with empty results (completes to selected item)
      if (e.key === "Tab" && filteredFiles.length > 0) {
        e.preventDefault();
        // Complete to the selected item (or first item if only one result)
        const targetItem = filteredFiles[selectedIndex] ?? filteredFiles[0];
        if (targetItem) {
          // Preserve line number suffix if present
          const lineSuffix = parsedQuery.lineNumber
            ? `:${parsedQuery.lineNumber}`
            : "";
          setQuery(targetItem.path + lineSuffix);
        }
        return;
      }

      if (filteredFiles.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredFiles.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            handleSelect(filteredFiles[selectedIndex], parsedQuery.lineNumber);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [
      filteredFiles,
      selectedIndex,
      handleSelect,
      setIsOpen,
      parsedQuery.lineNumber,
      setQuery,
    ],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (filteredFiles.length > 0) {
      rowVirtualizer.scrollToIndex(selectedIndex, { align: "auto" });
    }
  }, [selectedIndex, rowVirtualizer, filteredFiles.length]);

  // Get icon for file/folder
  const getIcon = useCallback((item: FileEntry) => {
    if (item.type === "folder") {
      const Icon = FolderClosedIcon;
      return Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : (
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      );
    }
    const Icon = getFileIconByExtension(item.label, true);
    return Icon ? (
      <Icon className="h-4 w-4 shrink-0" />
    ) : (
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
    );
  }, []);

  // Get directory path for display
  const getDirectory = useCallback((path: string, label: string) => {
    const dir = path.replace(new RegExp(`/?${label}$`), "");
    return dir || "";
  }, []);

  if (!browsePath) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="overflow-hidden p-0 max-w-[560px] gap-0"
        onKeyDown={handleKeyDown}
      >
        <Command shouldFilter={false} className="rounded-lg">
          <CommandInput
            ref={inputRef}
            placeholder="Go to file..."
            value={query}
            onValueChange={setQuery}
            className="h-11"
          />
          <CommandList
            ref={listRef}
            className="max-h-[432px]"
            style={{
              height:
                Math.min(filteredFiles.length, MAX_VISIBLE_ITEMS) *
                  ITEM_HEIGHT +
                8,
            }}
          >
            {!isLoading && filteredFiles.length === 0 && query && (
              <CommandEmpty>No files found</CommandEmpty>
            )}
            {!isLoading && filteredFiles.length === 0 && !query && (
              <CommandEmpty className="py-4 text-muted-foreground">
                Type to search files
              </CommandEmpty>
            )}
            {isLoading && (
              <CommandEmpty className="py-4 text-muted-foreground">
                Searching...
              </CommandEmpty>
            )}
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = filteredFiles[virtualRow.index];
                if (!item) return null;

                const isSelected = virtualRow.index === selectedIndex;
                const directory = getDirectory(item.path, item.label);

                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item, parsedQuery.lineNumber)}
                    onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                    className={cn(
                      "absolute top-0 left-0 w-full flex items-center gap-2 px-3 cursor-pointer",
                      isSelected && "bg-accent",
                    )}
                    style={{
                      height: `${ITEM_HEIGHT}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {getIcon(item)}
                    <span className="truncate font-medium text-sm">
                      {item.label}
                    </span>
                    {directory && (
                      <span className="truncate text-xs text-muted-foreground ml-auto">
                        {directory}
                      </span>
                    )}
                    {parsedQuery.lineNumber && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        :{parsedQuery.lineNumber}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </div>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
