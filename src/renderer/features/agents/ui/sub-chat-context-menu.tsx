import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../../../components/ui/context-menu";
import { Kbd } from "../../../components/ui/kbd";
import { isMac } from "../../../lib/utils";
import { getShortcutKey } from "../../../lib/utils/platform";
import type { SubChatMeta } from "../stores/sub-chat-store";

// Platform-aware keyboard shortcut
// Web: ⌥⌘W (browser uses Cmd+W to close tab)
// Desktop: ⌘W
const useCloseTabShortcut = () => {
  return useMemo(() => {
    if (!isMac) return "Alt+Ctrl+W";
    return getShortcutKey("closeTab");
  }, []);
};

interface SubChatContextMenuProps {
  subChat: SubChatMeta;
  isPinned: boolean;
  onTogglePin: (subChatId: string) => void;
  onRename: (subChat: SubChatMeta) => void;
  onArchive: (subChatId: string) => void;
  onArchiveOthers: (subChatId: string) => void;
  onArchiveAllBelow?: (subChatId: string) => void;
  onDelete?: (subChatId: string) => void;
  isOnlyChat: boolean;
  currentIndex?: number;
  totalCount?: number;
  showCloseTabOptions?: boolean;
  onCloseTab?: (subChatId: string) => void;
  onCloseOtherTabs?: (subChatId: string) => void;
  onCloseTabsToRight?: (subChatId: string, visualIndex: number) => void;
  visualIndex?: number;
  hasTabsToRight?: boolean;
  canCloseOtherTabs?: boolean;
}

export function SubChatContextMenu({
  subChat,
  isPinned,
  onTogglePin,
  onRename,
  onArchive,
  onArchiveOthers,
  onArchiveAllBelow,
  onDelete,
  isOnlyChat,
  currentIndex,
  totalCount,
  showCloseTabOptions = false,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  visualIndex = 0,
  hasTabsToRight = false,
  canCloseOtherTabs = false,
}: SubChatContextMenuProps) {
  const closeTabShortcut = useCloseTabShortcut();

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={() => onTogglePin(subChat.id)}>
        {isPinned ? "取消固定对话" : "固定对话"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onRename(subChat)}>
        重命名对话
      </ContextMenuItem>
      <ContextMenuSeparator />

      {showCloseTabOptions ? (
        <>
          <ContextMenuItem
            onClick={() => onCloseTab?.(subChat.id)}
            className="justify-between"
            disabled={isOnlyChat}
          >
            关闭对话
            {!isOnlyChat && <Kbd>{closeTabShortcut}</Kbd>}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onCloseOtherTabs?.(subChat.id)}
            disabled={!canCloseOtherTabs}
          >
            关闭其他对话
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onCloseTabsToRight?.(subChat.id, visualIndex)}
            disabled={!hasTabsToRight}
          >
            关闭右侧对话
          </ContextMenuItem>
        </>
      ) : (
        <>
          <ContextMenuItem
            onClick={() => onArchive(subChat.id)}
            className="justify-between"
            disabled={isOnlyChat}
          >
            归档对话
            {!isOnlyChat && <Kbd>{closeTabShortcut}</Kbd>}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onArchiveAllBelow?.(subChat.id)}
            disabled={
              currentIndex === undefined ||
              currentIndex >= (totalCount || 0) - 1
            }
          >
            归档以下对话
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onArchiveOthers(subChat.id)}
            disabled={isOnlyChat}
          >
            归档其他对话
          </ContextMenuItem>
        </>
      )}
      {onDelete && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDelete(subChat.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            永久删除对话
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
