"use client";

import { Code2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { FONT_MONO } from "../../../lib/fonts";
import { useCodeTheme } from "../../../lib/hooks/use-code-theme";
import { highlightCodeWithLineNumbers } from "../../../lib/themes/shiki-theme-loader";
import { cn } from "../../../lib/utils";
import { getFileIconByExtension } from "../mentions";

interface AgentCodeSnippetItemProps {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  onRemove?: () => void;
}

export function AgentCodeSnippetItem({
  id: _id,
  filePath,
  startLine,
  endLine,
  content,
  language,
  onRemove,
}: AgentCodeSnippetItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const themeId = useCodeTheme();

  // Get file name from path
  const fileName = filePath.split("/").pop() || filePath;

  // Get file icon
  const FileIcon = getFileIconByExtension(fileName) || Code2;

  // Format line range
  const lineRange =
    startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;

  // Highlight code when popover opens
  useEffect(() => {
    if (!isOpen || highlightedCode) return;

    let cancelled = false;

    const highlight = async () => {
      try {
        const html = await highlightCodeWithLineNumbers(
          content,
          language,
          themeId,
        );
        if (!cancelled) {
          setHighlightedCode(html);
        }
      } catch (error) {
        console.error("Failed to highlight code snippet:", error);
      }
    };

    highlight();

    return () => {
      cancelled = true;
    };
  }, [isOpen, content, language, themeId, highlightedCode]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded border border-border/50 max-w-[250px]",
            "hover:bg-muted/80 transition-colors cursor-pointer",
            isOpen && "bg-muted/80 border-border",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <FileIcon className="size-3.5 text-muted-foreground shrink-0" />

          <div className="flex items-center gap-1 min-w-0">
            <span
              className="text-xs text-foreground truncate"
              title={`${filePath}:${lineRange}`}
            >
              {fileName}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              :{lineRange}
            </span>
          </div>

          {onRemove && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove();
                }
              }}
              className={cn(
                "absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background border border-border",
                "flex items-center justify-center transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] z-10",
                "text-muted-foreground hover:text-foreground cursor-pointer",
                isHovered ? "opacity-100" : "opacity-0",
              )}
            >
              <X className="size-3" />
            </div>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className="w-auto max-w-[500px] p-0 overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <FileIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">
            {filePath}
          </span>
          <span className="text-[10px] text-muted-foreground">
            lines {lineRange}
          </span>
        </div>

        {/* Code preview */}
        <div className="max-h-[300px] overflow-auto select-text">
          {highlightedCode ? (
            <div
              className={cn(
                "shiki-with-line-numbers",
                "[&_pre]:m-0 [&_pre]:bg-transparent!",
                "[&_code]:m-0 [&_code]:bg-transparent!",
                "[&_.line]:block [&_.line]:min-h-[11px] [&_.line]:pl-4",
                "[&_.line]:before:inline-block [&_.line]:before:w-[3ch] [&_.line]:before:mr-4",
                "[&_.line]:before:text-right [&_.line]:before:text-muted-foreground/50",
                "[&_.line]:before:select-none [&_.line]:before:content-[counter(line)]",
                "[&_.line]:before:border-r [&_.line]:before:border-border/30 [&_.line]:before:pr-4",
              )}
              style={{
                fontFamily: FONT_MONO,
                fontSize: "11px",
                lineHeight: "1px",
                padding: "8px 0",
                tabSize: 2,
                counterReset: `line ${startLine - 1}`,
              }}
              dangerouslySetInnerHTML={{
                __html: highlightedCode.replace(
                  /<span class="line"/g,
                  '<span class="line" style="counter-increment: line;"',
                ),
              }}
            />
          ) : (
            <pre
              className="m-0 bg-transparent whitespace-pre p-2"
              style={{
                fontFamily: FONT_MONO,
                fontSize: "11px",
                lineHeight: "18px",
                tabSize: 2,
              }}
            >
              <code>{content}</code>
            </pre>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
