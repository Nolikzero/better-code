import type { FileMentionOption } from "../types";
import { FolderTree } from "./folder-tree";

/**
 * Render tooltip content for a mention option
 * Skills/agents show description, tools, model info
 * Tools show MCP server name
 * Files/folders show path
 */
export function MentionTooltipContent({
  option,
}: { option: FileMentionOption }) {
  if (option.type === "folder") {
    return <FolderTree path={option.path} />;
  }

  if (option.type === "skill" || option.type === "agent") {
    return (
      <div className="flex flex-col gap-1.5 w-full overflow-hidden">
        {option.description && (
          <p className="text-xs text-muted-foreground break-words">
            {option.description}
          </p>
        )}
        {option.model && (
          <div className="text-xs text-muted-foreground">
            Model: {option.model}
          </div>
        )}
        {option.tools && option.tools.length > 0 && (
          <div className="text-xs text-muted-foreground break-words">
            Tools: {option.tools.join(", ")}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground/70 font-mono truncate w-full">
          {option.path}
        </div>
      </div>
    );
  }

  if (option.type === "tool") {
    // Show full tool name (e.g., mcp__figma-local-mcp__get_figjam)
    return (
      <div className="text-xs text-muted-foreground font-mono">
        {option.path}
      </div>
    );
  }

  // Files - just path
  return (
    <div className="text-xs text-muted-foreground font-mono truncate w-full">
      {option.path}
    </div>
  );
}
