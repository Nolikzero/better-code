"use client";

import { atom, useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
  desktopNotificationsEnabledAtom,
  soundNotificationsEnabledAtom,
} from "../../../lib/atoms";
import { appStore } from "../../../lib/jotai-store";
import { isDesktopApp } from "../../../lib/utils/platform";

// Track pending notifications count for badge (ephemeral, resets on app launch)
const pendingNotificationsAtom = atom(0);

// Track window focus state
let isWindowFocused = true;

/**
 * Hook to manage desktop notifications and badge count
 * - Shows native notifications when window is not focused
 * - Updates dock badge with pending notification count
 * - Clears badge when window regains focus
 */
export function useDesktopNotifications() {
  const [pendingCount, setPendingCount] = useAtom(pendingNotificationsAtom);
  const isInitialized = useRef(false);

  // Subscribe to window focus changes
  useEffect(() => {
    if (!isDesktopApp() || typeof window === "undefined") return;

    // Initialize focus state
    isWindowFocused = document.hasFocus();

    const handleFocus = () => {
      isWindowFocused = true;
      // Clear badge when window gains focus
      setPendingCount(0);
      window.desktopApi?.setBadge(null);
    };

    const handleBlur = () => {
      isWindowFocused = false;
    };

    // Use both window events and Electron API
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Also subscribe to Electron focus events
    const unsubscribe = window.desktopApi?.onFocusChange?.((focused) => {
      if (focused) {
        handleFocus();
      } else {
        handleBlur();
      }
    });

    isInitialized.current = true;

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      unsubscribe?.();
    };
  }, [setPendingCount]);

  // Update badge when pending count changes
  useEffect(() => {
    if (!isDesktopApp() || typeof window === "undefined") return;

    if (pendingCount > 0) {
      window.desktopApi?.setBadge(pendingCount);
    } else {
      window.desktopApi?.setBadge(null);
    }
  }, [pendingCount]);

  /**
   * Show a notification for agent completion
   * Only shows if window is not focused (in desktop app)
   */
  const notifyAgentComplete = useCallback(
    (agentName: string, chatId?: string, subChatId?: string) => {
      if (!isDesktopApp() || typeof window === "undefined") return;

      if (!isWindowFocused) {
        setPendingCount((prev) => prev + 1);

        if (isDesktopNotificationsEnabled()) {
          window.desktopApi?.showNotification({
            title: "智能体已完成",
            body: `${agentName} 已完成任务`,
            chatId,
            subChatId,
          });
        }
      }
    },
    [setPendingCount],
  );

  const notifyPlanComplete = useCallback(
    (chatName: string, chatId?: string, subChatId?: string) => {
      if (!isDesktopApp() || typeof window === "undefined") return;

      if (!isWindowFocused) {
        setPendingCount((prev) => prev + 1);

        if (isDesktopNotificationsEnabled()) {
          window.desktopApi?.showNotification({
            title: "规划已就绪",
            body: `${chatName}：请审查建议的更改`,
            chatId,
            subChatId,
          });
        }
      }
    },
    [setPendingCount],
  );

  const notifyError = useCallback((title: string, body: string) => {
    if (!isDesktopApp() || typeof window === "undefined") return;

    if (!isWindowFocused && isDesktopNotificationsEnabled()) {
      window.desktopApi?.showNotification({
        title,
        body,
      });
    }
  }, []);

  const notifyTimeout = useCallback(
    (chatName: string, chatId?: string, subChatId?: string) => {
      if (!isDesktopApp() || typeof window === "undefined") return;

      if (!isWindowFocused) {
        setPendingCount((prev) => prev + 1);

        if (isDesktopNotificationsEnabled()) {
          window.desktopApi?.showNotification({
            title: "需要输入",
            body: `${chatName} 正在等待你的回复`,
            chatId,
            subChatId,
          });
        }
      }
    },
    [setPendingCount],
  );

  /**
   * Check if window is currently focused
   */
  const isAppFocused = useCallback(() => {
    return isWindowFocused;
  }, []);

  return {
    notifyAgentComplete,
    notifyPlanComplete,
    notifyError,
    notifyTimeout,
    isAppFocused,
    pendingCount,
    clearBadge: () => {
      setPendingCount(0);
      window.desktopApi?.setBadge(null);
    },
  };
}

function isDesktopNotificationsEnabled(): boolean {
  return appStore.get(desktopNotificationsEnabledAtom) !== false;
}

/**
 * Standalone function to show error notification (for use outside React components)
 */
export function showErrorNotification(title: string, body: string) {
  if (!isDesktopApp() || typeof window === "undefined") return;

  if (!document.hasFocus() && isDesktopNotificationsEnabled()) {
    window.desktopApi?.showNotification({
      title,
      body,
    });
  }
}

/**
 * Standalone function to show question notification immediately (for use outside React components)
 */
export function showQuestionNotification(
  chatName: string,
  chatId?: string,
  subChatId?: string,
) {
  if (!isDesktopApp() || typeof window === "undefined") return;

  if (!document.hasFocus() && isDesktopNotificationsEnabled()) {
    window.desktopApi?.showNotification({
      title: "智能体提问",
      body: `${chatName} 需要你的输入`,
      chatId,
      subChatId,
    });
  }
}

/**
 * Standalone function to show Ralph completion notification (for use outside React components)
 */
export function showRalphCompleteNotification(
  chatName: string,
  chatId?: string,
  subChatId?: string,
) {
  if (!isDesktopApp() || typeof window === "undefined") return;

  if (!document.hasFocus() && isDesktopNotificationsEnabled()) {
    window.desktopApi?.showNotification({
      title: "Ralph 已完成",
      body: `${chatName}：所有故事均已完成`,
      chatId,
      subChatId,
    });
  }
}

/**
 * Standalone function to show timeout notification (for use outside React components)
 */
export function showTimeoutNotification(
  chatName: string,
  chatId?: string,
  subChatId?: string,
) {
  if (!isDesktopApp() || typeof window === "undefined") return;

  if (!document.hasFocus() && isDesktopNotificationsEnabled()) {
    window.desktopApi?.showNotification({
      title: "需要输入",
      body: `${chatName} 正在等待你的回复`,
      chatId,
      subChatId,
    });
  }
}

/**
 * Play completion sound if sound notifications are enabled (for use outside React components)
 */
export function playCompletionSound() {
  const isSoundEnabled = appStore.get(soundNotificationsEnabledAtom);
  if (!isSoundEnabled) return;
  try {
    const audio = new Audio("./sound.mp3");
    audio.volume = 1.0;
    audio.play().catch(() => {});
  } catch {
    // Ignore audio errors
  }
}
