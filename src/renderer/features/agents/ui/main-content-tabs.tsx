"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FileText, GitBranch, MessageSquare, X } from "lucide-react";
import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { cn } from "../../../lib/utils";
import {
  centerFilePathAtom,
  diffViewingModeAtom,
  effectiveDiffDataAtom,
  type MainContentTab,
  mainContentActiveTabAtom,
} from "../atoms";

// Get filename from path
function getFileName(path: string | null): string {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1] || "";
}

// Truncate filename if too long
function truncateFileName(name: string, maxLength = 20): string {
  if (name.length <= maxLength) return name;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const baseName = name.slice(0, name.lastIndexOf(".") || name.length);
  const availableLength = maxLength - ext.length - 3; // 3 for "..."
  return `${baseName.slice(0, availableLength)}...${ext}`;
}

interface TabConfig {
  id: MainContentTab;
  label: string;
  fullLabel?: string;
  icon: React.ReactNode;
  badge?: number;
  visible: boolean;
  closable?: boolean;
  onClose?: () => void;
}

export function MainContentTabs() {
  const [activeTab, setActiveTab] = useAtom(mainContentActiveTabAtom);
  const filePath = useAtomValue(centerFilePathAtom);
  const setFilePath = useSetAtom(centerFilePathAtom);

  // Use centralized effective diff data atom
  const { diffData, showMultiRepo, multiRepoDiffData } = useAtomValue(
    effectiveDiffDataAtom,
  );

  const multiRepoFileCount = showMultiRepo
    ? multiRepoDiffData!.repos.reduce(
        (sum, r) => sum + r.diffStats.fileCount,
        0,
      )
    : 0;
  const hasChanges =
    (diffData?.diffStats?.hasChanges ?? false) || showMultiRepo;
  const changesCount =
    (diffData?.diffStats?.fileCount ?? 0) + multiRepoFileCount;

  // Track viewing mode to avoid resetting tab when viewing commit/full diffs
  const viewingMode = useAtomValue(diffViewingModeAtom);

  const hasFile = !!filePath;
  const fileName = getFileName(filePath);

  // Note: Auto-fallback logic (switching to chat when file/changes tabs become unavailable)
  // is now handled in AgentsContent to ensure it runs even when this component doesn't render

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: "chat",
        label: "Chat",
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        visible: true,
      },
      {
        id: "file",
        label: truncateFileName(fileName),
        fullLabel: filePath || undefined,
        icon: <FileText className="h-3.5 w-3.5" />,
        visible: hasFile,
        closable: true,
        onClose: () => {
          setFilePath(null);
          if (activeTab === "file") {
            setActiveTab("chat");
          }
        },
      },
      {
        id: "changes",
        label: "Changes",
        icon: <GitBranch className="h-3.5 w-3.5" />,
        badge: changesCount,
        visible: hasChanges || viewingMode.type !== "uncommitted",
      },
    ],
    [
      fileName,
      filePath,
      hasFile,
      hasChanges,
      changesCount,
      activeTab,
      setFilePath,
      setActiveTab,
      viewingMode.type,
    ],
  );

  const visibleTabs = tabs.filter((tab) => tab.visible);

  // Don't render if only chat tab is visible (no file, no changes)
  if (visibleTabs.length <= 1) {
    return null;
  }

  // Calculate active tab index for indicator positioning
  const activeIndex = visibleTabs.findIndex((tab) => tab.id === activeTab);
  const tabWidth = 100 / visibleTabs.length;

  return (
    <div className="px-3 pt-2 pb-1 border-b border-border/50">
      <div className="relative rounded h-8 p-0.5 flex">
        {/* Sliding background indicator */}
        <div
          className="absolute inset-y-0.5 rounded shadow transition-all duration-200 ease-in-out"
          style={{
            width: `calc(${tabWidth}% - 2px)`,
            left:
              activeIndex >= 0
                ? `calc(${activeIndex * tabWidth}% + 1px)`
                : "1px",
          }}
        />

        {visibleTabs.map((tab) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative z-[2] flex-1 h-full flex items-center justify-center gap-1.5 transition-colors duration-200 rounded text-xs group",
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                {tab.icon}
                <span className="truncate max-w-[100px]">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
                {tab.closable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      tab.onClose?.();
                    }}
                    className="ml-0.5 p-0.5 rounded hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Close ${tab.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {tab.fullLabel || tab.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
