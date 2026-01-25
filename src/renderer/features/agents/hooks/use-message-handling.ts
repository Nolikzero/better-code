"use client";

import type { Chat } from "@ai-sdk/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { getQueryClient } from "../../../contexts/TRPCProvider";
import {
  addedDirectoriesAtomFamily,
  codeSnippetsAtomFamily,
  historyNavAtomFamily,
  mainContentActiveTabAtom,
  promptHistoryAtomFamily,
} from "../atoms";
import type { useBranchSwitchConfirmation } from "../hooks/use-branch-switch-confirmation";
import { clearSubChatDraft } from "../lib/drafts";
import type { AgentsMentionsEditorHandle } from "../mentions";
import { agentChatStore } from "../stores/agent-chat-store";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

export interface UseMessageHandlingOptions {
  // Chat state
  subChatId: string;
  parentChatId: string;
  teamId?: string | null;

  // Chat functions from useChat hook
  sendMessage: Chat<any>["sendMessage"];
  stop: Chat<any>["stop"];
  messages: Chat<any>["messages"];
  status: Chat<any>["status"];

  // Editor ref
  editorRef: React.RefObject<AgentsMentionsEditorHandle | null>;

  // Upload state from useAgentsFileUpload
  images: Array<{
    isLoading: boolean;
    url: string;
    mediaType?: string;
    filename: string;
    base64Data?: string;
  }>;
  files: Array<{
    isLoading: boolean;
    url: string;
    type?: string;
    filename: string;
    size?: number;
  }>;
  clearAll: () => void;

  // Callbacks
  onAutoRename: (userMessage: string, subChatId: string) => void;
  scrollToBottom: () => void;

  // Branch switching
  branchSwitchForMessage: ReturnType<typeof useBranchSwitchConfirmation>;

  // Refs for tracking state
  currentDraftTextRef: React.MutableRefObject<string>;
  hasTriggeredRenameRef: React.MutableRefObject<boolean>;

  // Sandbox state
  sandboxSetupStatus: "ready" | "initializing" | "error" | "cloning";

  // Archive state
  isArchived: boolean;
  onRestoreWorkspace?: () => void;

  // Overlay mode
  isOverlayMode: boolean;

  // Utils for cache invalidation (from api.useUtils())
  utils: any;
}

export interface UseMessageHandlingReturn {
  handleSend: () => Promise<void>;
  handleStop: () => Promise<void>;
  handleCompact: () => void;
  handleConfirmBranchSwitchForMessage: () => Promise<void>;
  stableHandleSend: () => Promise<void>;
}

export function useMessageHandling(
  options: UseMessageHandlingOptions,
): UseMessageHandlingReturn {
  const {
    subChatId,
    parentChatId,
    teamId,
    sendMessage,
    stop,
    messages,
    status,
    editorRef,
    images,
    files,
    clearAll,
    onAutoRename,
    scrollToBottom,
    branchSwitchForMessage,
    currentDraftTextRef,
    hasTriggeredRenameRef,
    sandboxSetupStatus,
    isArchived,
    onRestoreWorkspace,
    isOverlayMode,
    utils,
  } = options;

  // Atom state
  const historyKey = `chat:${parentChatId}`;
  const [, addToHistory] = useAtom(promptHistoryAtomFamily(historyKey));
  const [, setNavState] = useAtom(historyNavAtomFamily(historyKey));
  const [codeSnippets, setCodeSnippets] = useAtom(
    codeSnippetsAtomFamily(subChatId),
  );
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const _addedDirs = useAtomValue(addedDirectoriesAtomFamily(subChatId));

  const isStreaming = status === "streaming" || status === "submitted";

  // Stable stop handler - shared by SubChatStatusCard and AgentSendButton
  const handleStop = useCallback(async () => {
    agentChatStore.setManuallyAborted(subChatId, true);
    await stop();
    await fetch(`/api/agents/chat?id=${encodeURIComponent(subChatId)}`, {
      method: "DELETE",
      credentials: "include",
    });
  }, [subChatId, stop]);

  // Handler to trigger manual context compaction
  const handleCompact = useCallback(() => {
    if (isStreaming) return; // Can't compact while streaming
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: "/compact" }],
    });
  }, [isStreaming, sendMessage]);

  const handleSend = useCallback(async () => {
    // Block sending while sandbox is still being set up
    if (sandboxSetupStatus !== "ready") {
      return;
    }

    // Auto-restore archived workspace when sending a message
    if (isArchived && onRestoreWorkspace) {
      onRestoreWorkspace();
    }

    // Get value from uncontrolled editor
    const inputValue = editorRef.current?.getValue() || "";
    const hasText = inputValue.trim().length > 0;
    const hasImages =
      images.filter((img) => !img.isLoading && img.url).length > 0;

    if (!hasText && !hasImages) return;

    const text = inputValue.trim();

    // Build message parts FIRST (before any state changes)
    // Include base64Data for API transmission
    const parts: any[] = [
      ...images
        .filter((img) => !img.isLoading && img.url)
        .map((img) => ({
          type: "data-image" as const,
          data: {
            url: img.url,
            mediaType: img.mediaType,
            filename: img.filename,
            base64Data: img.base64Data, // Include base64 data for Claude API
          },
        })),
      ...files
        .filter((f) => !f.isLoading && f.url)
        .map((f) => ({
          type: "data-file" as const,
          data: {
            url: f.url,
            mediaType: f.type,
            filename: f.filename,
            size: f.size,
          },
        })),
    ];

    // Build the text content, including code snippets as context
    let finalText = text;
    if (codeSnippets.length > 0) {
      const snippetContext = codeSnippets
        .map(
          (s) =>
            `\`\`\`${s.language} ${s.filePath}:${s.startLine}-${s.endLine}\n${s.content}\n\`\`\``,
        )
        .join("\n\n");
      const contextPrefix = `Here's some code context:\n\n${snippetContext}\n\n`;
      finalText = text ? `${contextPrefix}${text}` : contextPrefix.trim();
    }

    if (finalText) {
      parts.push({ type: "text", text: finalText });
    }

    // Check if branch switch is needed before sending (local mode only)
    const needsSwitch = await branchSwitchForMessage.checkBranchSwitch(
      "send-message",
      { messageParts: parts },
    );
    if (needsSwitch) return; // Dialog shown, wait for confirmation

    // Add to prompt history before sending
    if (text) {
      addToHistory(text);
    }
    setNavState({ index: -1, savedInput: "" });

    // Clear editor and draft from localStorage
    editorRef.current?.clear();
    currentDraftTextRef.current = "";
    if (parentChatId) {
      clearSubChatDraft(parentChatId, subChatId);
    }

    // Trigger auto-rename on first message in a new sub-chat
    if (messages.length === 0 && !hasTriggeredRenameRef.current) {
      hasTriggeredRenameRef.current = true;
      onAutoRename(text || "Image message", subChatId);
    }

    clearAll();

    // Clear code snippets after sending
    if (codeSnippets.length > 0) {
      setCodeSnippets([]);
    }

    // Switch to chat tab after sending message in overlay mode
    if (isOverlayMode) {
      setActiveTab("chat");
    }

    // Optimistic update: immediately update chat's updatedAt and resort array for instant sidebar resorting
    if (teamId) {
      const now = new Date();
      utils.agents.getAgentChats.setData(
        { teamId },
        (old: any[] | undefined) => {
          if (!old) return old;
          // Update the timestamp and sort by updatedAt descending
          const updated = old.map((c: any) =>
            c.id === parentChatId ? { ...c, updatedAt: now } : c,
          );
          return updated.sort(
            (a: any, b: any) =>
              new Date(b.updatedAt ?? 0).getTime() -
              new Date(a.updatedAt ?? 0).getTime(),
          );
        },
      );
    }

    // Desktop app: Optimistic update for chats.list to update sidebar immediately
    const queryClient = getQueryClient();
    if (queryClient) {
      const now = new Date();
      const queries = queryClient.getQueryCache().getAll();
      const chatsListQuery = queries.find(
        (q) =>
          Array.isArray(q.queryKey) &&
          Array.isArray(q.queryKey[0]) &&
          q.queryKey[0][0] === "chats" &&
          q.queryKey[0][1] === "list",
      );
      if (chatsListQuery) {
        queryClient.setQueryData(
          chatsListQuery.queryKey,
          (old: any[] | undefined) => {
            if (!old) return old;
            // Update the timestamp and sort by updatedAt descending
            const updated = old.map((c: any) =>
              c.id === parentChatId ? { ...c, updatedAt: now } : c,
            );
            return updated.sort(
              (a: any, b: any) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            );
          },
        );
      }
    }

    // Optimistically update sub-chat timestamp to move it to top
    useAgentSubChatStore.getState().updateSubChatTimestamp(subChatId);

    // Force scroll to bottom when sending a message
    scrollToBottom();

    try {
      await sendMessage({ role: "user", parts });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send message";
      toast.error("Message failed to send", {
        description: errorMessage,
        duration: 5000,
      });
      // Restore editor content so user can retry
      if (finalText) {
        editorRef.current?.setValue(finalText);
      }
      console.error("[handleSend] sendMessage failed:", error);
    }
  }, [
    sandboxSetupStatus,
    isArchived,
    onRestoreWorkspace,
    editorRef,
    images,
    files,
    codeSnippets,
    branchSwitchForMessage,
    addToHistory,
    setNavState,
    parentChatId,
    subChatId,
    currentDraftTextRef,
    messages.length,
    hasTriggeredRenameRef,
    onAutoRename,
    clearAll,
    setCodeSnippets,
    isOverlayMode,
    setActiveTab,
    teamId,
    utils,
    scrollToBottom,
    sendMessage,
  ]);

  // Handler for confirming branch switch and then sending the pending message
  const handleConfirmBranchSwitchForMessage = useCallback(async () => {
    const result = await branchSwitchForMessage.confirmSwitch();
    if (!result.success) return;

    // Get stored message parts from payload
    const payload = result.payload as { messageParts: any[] } | undefined;
    const messageParts = payload?.messageParts;
    if (!messageParts) return;

    // Extract text from message parts for history
    const textPart = messageParts.find((p: any) => p.type === "text");
    const text = textPart?.text || "";

    // Add to prompt history before sending
    if (text) {
      addToHistory(text);
    }
    setNavState({ index: -1, savedInput: "" });

    // Clear editor and draft from localStorage
    editorRef.current?.clear();
    currentDraftTextRef.current = "";
    if (parentChatId) {
      clearSubChatDraft(parentChatId, subChatId);
    }

    // Trigger auto-rename on first message in a new sub-chat
    if (messages.length === 0 && !hasTriggeredRenameRef.current) {
      hasTriggeredRenameRef.current = true;
      // Extract text for rename (use first 50 chars or "Image message" if no text)
      const renameText = text || "Image message";
      onAutoRename(renameText, subChatId);
    }

    clearAll();

    // Optimistic update: immediately update chat's updatedAt and resort array for instant sidebar resorting
    if (teamId) {
      const now = new Date();
      utils.agents.getAgentChats.setData(
        { teamId },
        (old: any[] | undefined) => {
          if (!old) return old;
          // Update the timestamp and sort by updatedAt descending
          const updated = old.map((c: any) =>
            c.id === parentChatId ? { ...c, updatedAt: now } : c,
          );
          return updated.sort(
            (a: any, b: any) =>
              new Date(b.updatedAt ?? 0).getTime() -
              new Date(a.updatedAt ?? 0).getTime(),
          );
        },
      );
    }

    // Desktop app: Optimistic update for chats.list to update sidebar immediately
    const queryClient = getQueryClient();
    if (queryClient) {
      const now = new Date();
      const queries = queryClient.getQueryCache().getAll();
      const chatsListQuery = queries.find(
        (q) =>
          Array.isArray(q.queryKey) &&
          Array.isArray(q.queryKey[0]) &&
          q.queryKey[0][0] === "chats" &&
          q.queryKey[0][1] === "list",
      );
      if (chatsListQuery) {
        queryClient.setQueryData(
          chatsListQuery.queryKey,
          (old: any[] | undefined) => {
            if (!old) return old;
            // Update the timestamp and sort by updatedAt descending
            const updated = old.map((c: any) =>
              c.id === parentChatId ? { ...c, updatedAt: now } : c,
            );
            return updated.sort(
              (a: any, b: any) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            );
          },
        );
      }
    }

    // Optimistically update sub-chat timestamp to move it to top
    useAgentSubChatStore.getState().updateSubChatTimestamp(subChatId);

    // Force scroll to bottom when sending a message
    scrollToBottom();

    // Now send the message
    try {
      await sendMessage({ role: "user", parts: messageParts });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send message";
      toast.error("Message failed to send", {
        description: errorMessage,
        duration: 5000,
      });
      // Restore editor content so user can retry
      if (text) {
        editorRef.current?.setValue(text);
      }
      console.error(
        "[handleConfirmBranchSwitchForMessage] sendMessage failed:",
        error,
      );
    }
  }, [
    branchSwitchForMessage,
    addToHistory,
    setNavState,
    editorRef,
    currentDraftTextRef,
    parentChatId,
    subChatId,
    messages.length,
    hasTriggeredRenameRef,
    onAutoRename,
    clearAll,
    teamId,
    utils,
    scrollToBottom,
    sendMessage,
  ]);

  // Stable ref for handleSend - allows passing a stable callback to child components
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  const stableHandleSend = useCallback(async () => {
    await handleSendRef.current();
  }, []);

  return {
    handleSend,
    handleStop,
    handleCompact,
    handleConfirmBranchSwitchForMessage,
    stableHandleSend,
  };
}
