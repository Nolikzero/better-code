"use client";

import { useAtom } from "jotai";
import { FolderPlus, X } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { trpcClient } from "../../../lib/trpc";
import { addedDirectoriesAtomFamily } from "../atoms";

interface AddedDirectoriesBadgeProps {
  subChatId: string;
}

/**
 * Added Directories Badge
 *
 * Shows a badge with the count of added directories.
 * Clicking it opens a popover with:
 * - List of added directories with remove buttons
 * - Hint about /add-dir command
 */
export const AddedDirectoriesBadge = memo(function AddedDirectoriesBadge({
  subChatId,
}: AddedDirectoriesBadgeProps) {
  const [addedDirs, setAddedDirs] = useAtom(
    addedDirectoriesAtomFamily(subChatId),
  );

  // Remove a directory from the list
  const handleRemove = async (dirPath: string) => {
    const newDirs = addedDirs.filter((d) => d !== dirPath);
    try {
      // Update DB
      await trpcClient.chats.updateSubChatAddedDirs.mutate({
        id: subChatId,
        addedDirs: newDirs,
      });
      // Update atom
      setAddedDirs(newDirs);
      toast.success("Directory removed from context");
    } catch (error) {
      console.error("Failed to remove directory:", error);
      toast.error("Failed to remove directory");
    }
  };

  // Don't show if no added directories
  if (!addedDirs || addedDirs.length === 0) {
    return null;
  }

  // Get display name (last part of path)
  const getDisplayName = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  };

  return (
    <Popover>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md"
              aria-label="Added Directories"
              aria-haspopup="dialog"
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                +{addedDirs.length} dir{addedDirs.length !== 1 ? "s" : ""}
              </span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {addedDirs.length} additional director
          {addedDirs.length !== 1 ? "ies" : "y"} added to context
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        className="w-72 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        role="dialog"
        aria-label="Added Directories"
      >
        <div className="px-3 py-2 border-b">
          <h4 className="font-medium text-sm" id="added-dirs-title">
            Additional Directories
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Added to chat context via /add-dir
          </p>
        </div>

        <div
          className="max-h-64 overflow-y-auto py-1"
          role="list"
          aria-labelledby="added-dirs-title"
        >
          {addedDirs.map((dir) => (
            <div
              key={dir}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 group"
              role="listitem"
            >
              <FolderPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="truncate block font-medium">
                  {getDisplayName(dir)}
                </span>
                <span
                  className="text-[10px] text-muted-foreground/70 truncate block"
                  title={dir}
                >
                  {dir}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(dir)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                aria-label={`Remove ${getDisplayName(dir)}`}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          Use <code className="bg-muted px-1 py-0.5 rounded">/add-dir</code> to
          add more directories
        </div>
      </PopoverContent>
    </Popover>
  );
});
