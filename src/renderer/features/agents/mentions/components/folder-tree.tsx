import { cn } from "../../../../lib/utils";
import { FolderOpenIcon } from "../icons";

/**
 * Render folder path as a tree structure for tooltip
 * e.g., "apps/web/app" becomes:
 *   📁 apps
 *     📁 web
 *       📁 app
 */
export function FolderTree({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  const lastIndex = parts.length - 1;

  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      {parts.map((part, index) => {
        const isLast = index === lastIndex;
        return (
          <div
            key={index}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              isLast ? "text-foreground" : "text-muted-foreground",
            )}
            style={{ paddingLeft: `${index * 20}px` }}
          >
            <FolderOpenIcon
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                isLast ? "text-foreground/70" : "text-muted-foreground",
              )}
            />
            <span className={isLast ? "font-medium" : ""}>{part}</span>
          </div>
        );
      })}
    </div>
  );
}
