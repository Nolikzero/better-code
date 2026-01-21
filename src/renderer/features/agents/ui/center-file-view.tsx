"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { FilesIcon } from "../../../components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { useCodeTheme } from "../../../lib/hooks/use-code-theme";
import { api } from "../../../lib/mock-api";
import { highlightCodeWithLineNumbers } from "../../../lib/themes/shiki-theme-loader";
import { trpc } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import {
  type CodeSnippet,
  centerFileLineAtom,
  centerFilePathAtom,
  codeSnippetsAtomFamily,
  mainContentActiveTabAtom,
  selectedAgentChatIdAtom,
  selectedProjectAtom,
} from "../atoms";
import { getFileIconByExtension } from "../mentions/icons/file-icons";
import { useAgentSubChatStore } from "../stores/sub-chat-store";
import { CodeSelectionContextMenu } from "./code-selection-context-menu";

/**
 * Get language ID from file extension for syntax highlighting.
 * Only includes languages that are loaded in shiki (see shiki-theme-loader.ts SUPPORTED_LANGUAGES).
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  // Map file extensions to shiki language IDs
  // Note: Only languages in SUPPORTED_LANGUAGES will have syntax highlighting
  const languageMap: Record<string, string> = {
    // TypeScript/JavaScript
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    // Python
    py: "python",
    pyw: "python",
    pyi: "python",
    // Other languages
    go: "go",
    rs: "rust",
    // Markup
    md: "markdown",
    mdx: "markdown",
    html: "html",
    htm: "html",
    // Styles
    css: "css",
    scss: "css",
    sass: "css",
    // Data formats
    json: "json",
    jsonc: "json",
    // Shell (yaml not supported by shiki, will fallback to plaintext)
    sh: "bash",
    bash: "bash",
    zsh: "bash",
  };

  return languageMap[ext] || "plaintext";
}

/**
 * Full file viewer for the center/main content area.
 * Shows file content with syntax highlighting.
 */
export function CenterFileView() {
  const selectedProject = useAtomValue(selectedProjectAtom);
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom);
  const [filePath, setFilePath] = useAtom(centerFilePathAtom);
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const themeId = useCodeTheme();

  // Get active sub-chat for code snippets
  const activeSubChatId = useAgentSubChatStore((s) => s.activeSubChatId);
  const setCodeSnippets = useSetAtom(
    codeSnippetsAtomFamily(activeSubChatId || ""),
  );

  // Handle adding code snippet to chat
  const handleAddToChat = useCallback(
    (snippet: CodeSnippet) => {
      if (!activeSubChatId) return;
      setCodeSnippets((prev) => [...prev, snippet]);
    },
    [activeSubChatId, setCodeSnippets],
  );

  // Get agent chat to check for worktree path
  const { data: agentChat } = api.agents.getAgentChat.useQuery(
    { chatId: selectedChatId! },
    { enabled: !!selectedChatId },
  );

  // Use worktree path if set, otherwise project path (same as project-file-tree.tsx)
  const browsePath = agentChat?.worktreePath || selectedProject?.path;

  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Target line number from Quick Open (e.g., "file.ts:42")
  const [targetLine, setTargetLine] = useAtom(centerFileLineAtom);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch file content - use browsePath (worktree or project)
  const { data: fileData, isLoading } = trpc.files.readFileContent.useQuery(
    {
      projectPath: browsePath ?? "",
      relativePath: filePath ?? "",
    },
    {
      enabled: !!browsePath && !!filePath,
    },
  );

  // Get file name and icon
  const fileName = useMemo(() => {
    if (!filePath) return "";
    return filePath.split("/").pop() || filePath;
  }, [filePath]);

  const FileIcon = useMemo(() => {
    if (!fileName) return FilesIcon;
    return getFileIconByExtension(fileName) || FilesIcon;
  }, [fileName]);

  const language = useMemo(() => {
    if (!filePath) return "plaintext";
    return getLanguageFromPath(filePath);
  }, [filePath]);

  // Highlight code when content or theme changes (includes line structure for CSS line numbers)
  useEffect(() => {
    if (!fileData?.content) {
      setHighlightedCode(null);
      return;
    }

    let cancelled = false;

    const highlight = async () => {
      try {
        console.log("[CenterFileView] Highlighting with:", {
          language,
          themeId,
        });
        const html = await highlightCodeWithLineNumbers(
          fileData.content,
          language,
          themeId,
        );
        console.log(
          "[CenterFileView] Highlighted HTML sample:",
          html.slice(0, 500),
        );
        if (!cancelled) {
          setHighlightedCode(html);
        }
      } catch (error) {
        console.error("Failed to highlight code:", error);
        // On error, leave as null to use fallback
      }
    };

    highlight();

    return () => {
      cancelled = true;
    };
  }, [fileData?.content, language, themeId]);

  // Scroll to target line when file loads and line is specified
  useEffect(() => {
    if (
      !targetLine ||
      !scrollContainerRef.current ||
      isLoading ||
      !fileData?.content
    )
      return;

    // Calculate scroll position (18px line height + 16px padding)
    const LINE_HEIGHT = 18;
    const PADDING_TOP = 16;
    const scrollTop = Math.max(
      0,
      (targetLine - 1) * LINE_HEIGHT + PADDING_TOP - 100,
    ); // 100px offset to show context above

    // Scroll with a small delay to ensure content is rendered
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({
        top: scrollTop,
        behavior: "smooth",
      });
    });

    // Highlight the target line briefly
    setHighlightedLine(targetLine);

    // Clear target line after scrolling (so it doesn't re-trigger)
    setTargetLine(null);
  }, [targetLine, isLoading, fileData?.content, setTargetLine]);

  // Clear line highlight after 2 seconds
  useEffect(() => {
    if (highlightedLine === null) return;
    const timer = setTimeout(() => setHighlightedLine(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedLine]);

  // Handle close - switch to chat tab and clear file path
  const handleClose = () => {
    setActiveTab("chat");
    setFilePath(null);
  };

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle copy
  const handleCopy = async () => {
    if (!fileData?.content) return;
    try {
      await navigator.clipboard.writeText(fileData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Show error state
  if (fileData?.error) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-12 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-7 w-7 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Back (Esc)
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2">
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{filePath}</span>
            </div>
          </div>
        </div>

        {/* Error content */}
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {fileData.error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-border/50 shrink-0">
        {/* Left: Back button and file info */}
        <div className="flex items-center gap-3 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-7 w-7 p-0 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Back (Esc)
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2 min-w-0">
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span
              className="text-sm font-medium truncate"
              title={filePath ?? ""}
            >
              {filePath}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={!fileData?.content}
                className="h-7 w-7 p-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {copied ? "Copied!" : "Copy content"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <CodeSelectionContextMenu
        filePath={filePath ?? ""}
        language={language}
        onAddToChat={handleAddToChat}
      >
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto select-text"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : highlightedCode ? (
            /* Native Shiki output with CSS-based line numbers */
            <div
              className={cn(
                "shiki-with-line-numbers",
                // Reset Shiki's default styles
                "[&_pre]:m-0 [&_pre]:bg-transparent!",
                "[&_code]:m-0 [&_code]:bg-transparent!",
                // Line structure styling with CSS counter for line numbers
                "[&_.line]:block [&_.line]:min-h-[16px] [&_.line]:pl-4",
                "[&_.line]:before:inline-block [&_.line]:before:w-[3ch] [&_.line]:before:mr-4",
                "[&_.line]:before:text-right [&_.line]:before:text-muted-foreground/50",
                "[&_.line]:before:select-none [&_.line]:before:content-[counter(line)]",
                "[&_.line]:before:border-r [&_.line]:before:border-border/30 [&_.line]:before:pr-4",
                // Highlighted line styling
                highlightedLine &&
                  `[&_.line:nth-child(${highlightedLine})]:bg-yellow-500/20`,
              )}
              style={{
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                fontSize: "12px",
                lineHeight: "1px",
                padding: "16px 0",
                tabSize: 2,
                counterReset: "line",
              }}
              // Using CSS counter-increment on each line via global style
              dangerouslySetInnerHTML={{
                __html: highlightedCode.replace(
                  /<span class="line"/g,
                  '<span class="line" style="counter-increment: line;"',
                ),
              }}
            />
          ) : (
            /* Fallback for plaintext or loading state */
            <pre
              className="m-0 bg-transparent whitespace-pre"
              style={{
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                fontSize: "12px",
                lineHeight: highlightedCode ? "1px" : "16px",
                padding: "16px",
                tabSize: 2,
              }}
            >
              <code>{fileData?.content ?? ""}</code>
            </pre>
          )}
        </div>
      </CodeSelectionContextMenu>
    </div>
  );
}
