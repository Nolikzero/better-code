"use client";

import type { Chat } from "@ai-sdk/react";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { appStore } from "../../../lib/jotai-store";
import { trpc } from "../../../lib/trpc";
import { pendingRalphAutoStartsAtom, ralphInjectedPromptsAtom } from "../atoms";

export interface UseRalphAutoStartOptions {
  subChatId: string;
  parentChatId: string;
  agentMode: "plan" | "agent" | "ralph";
  isStreaming: boolean;
  messages: Chat<any>["messages"];
  sendMessage: Chat<any>["sendMessage"];
  setMessages: (messages: any[] | ((prev: any[]) => any[])) => void;
}

export interface UseRalphAutoStartReturn {
  ralphSetupOpen: boolean;
  setRalphSetupOpen: (open: boolean) => void;
  ralphState:
    | {
        hasPrd: boolean;
        nextStory?: {
          id: string;
          title: string;
          description: string;
          type?: "research" | "implementation";
          acceptanceCriteria?: string[];
        } | null;
      }
    | undefined;
}

/**
 * Hook to manage Ralph PRD workflows including:
 * - Loading Ralph state (PRD existence, next story)
 * - Auto-opening setup dialog when switching to Ralph mode without PRD
 * - Auto-starting next story after PRD generation
 * - Injecting modified prompts into chat messages
 */
export function useRalphAutoStart(
  options: UseRalphAutoStartOptions,
): UseRalphAutoStartReturn {
  const {
    subChatId,
    parentChatId,
    agentMode,
    isStreaming,
    messages,
    sendMessage,
    setMessages,
  } = options;

  // Ralph state query - to check if PRD exists for showing setup dialog
  const { data: ralphState } = trpc.ralph.getState.useQuery(
    { chatId: parentChatId },
    { enabled: !!parentChatId && agentMode === "ralph" },
  );

  // Ralph setup dialog state
  const [ralphSetupOpen, setRalphSetupOpen] = useState(false);

  // Open Ralph setup dialog when switching to Ralph mode if no PRD exists
  const prevAgentModeRef = useRef(agentMode);
  useEffect(() => {
    const wasNotRalph = prevAgentModeRef.current !== "ralph";
    const isNowRalph = agentMode === "ralph";
    prevAgentModeRef.current = agentMode;

    // Only trigger when switching TO ralph mode
    if (wasNotRalph && isNowRalph && ralphState !== undefined) {
      // PRD doesn't exist - open setup dialog
      if (!ralphState?.hasPrd) {
        setRalphSetupOpen(true);
      }
    }
  }, [agentMode, ralphState]);

  // Update in-memory Chat messages when Ralph injects modified prompt
  const ralphInjectedPrompts = useAtomValue(ralphInjectedPromptsAtom);
  const myInjectedPrompt = ralphInjectedPrompts.get(subChatId) ?? null;

  useEffect(() => {
    if (myInjectedPrompt && messages.length > 0) {
      const lastUserMsgIdx = messages.findLastIndex(
        (m: any) => m.role === "user",
      );
      if (lastUserMsgIdx >= 0) {
        setMessages((prev: any[]) =>
          prev.map((m: any, i: number) =>
            i === lastUserMsgIdx
              ? {
                  ...m,
                  parts: [{ type: "text", text: myInjectedPrompt.text }],
                }
              : m,
          ),
        );
        // Clear only this sub-chat's entry
        const updated = new Map(appStore.get(ralphInjectedPromptsAtom));
        updated.delete(subChatId);
        appStore.set(ralphInjectedPromptsAtom, updated);
      }
    }
  }, [myInjectedPrompt, subChatId, messages.length, setMessages]);

  // Watch for pending Ralph auto-start (after PRD generation)
  const pendingRalphAutoStarts = useAtomValue(pendingRalphAutoStartsAtom);
  const myPendingAutoStart = pendingRalphAutoStarts.get(subChatId) ?? null;

  useEffect(() => {
    // Debug logging
    console.log(
      "[ralph] useEffect check - myPendingAutoStart:",
      myPendingAutoStart,
      "subChatId:",
      subChatId,
      "isStreaming:",
      isStreaming,
      "nextStory:",
      ralphState?.nextStory?.id,
    );

    // Only auto-start when:
    // 1. There's a pending auto-start for this sub-chat
    // 2. Not currently streaming
    // 3. Ralph state has loaded with correct story data
    if (myPendingAutoStart && !isStreaming) {
      const nextStory = ralphState?.nextStory;
      const completedStoryId = myPendingAutoStart.completedStoryId;

      // Wait for ralphState to load
      if (!ralphState?.hasPrd) {
        console.log("[ralph] Waiting for ralphState to load...");
        return;
      }

      // If we just completed a story, wait until nextStory is different
      // This ensures the query has refetched with updated data
      if (completedStoryId && nextStory?.id === completedStoryId) {
        console.log(
          "[ralph] Waiting for nextStory to update (still showing completed story:",
          completedStoryId,
          ")",
        );
        return;
      }

      // Clear only this sub-chat's pending flag
      const updated = new Map(appStore.get(pendingRalphAutoStartsAtom));
      updated.delete(subChatId);
      appStore.set(pendingRalphAutoStartsAtom, updated);

      // Build message with actual story details
      if (!nextStory) {
        // All stories complete - no need to continue
        console.log("[ralph] No next story available - all stories complete");
        return;
      }

      const acceptanceCriteria =
        nextStory.acceptanceCriteria?.join("\n  - ") || "";

      // Use explicit type from PRD (AI sets this when generating stories)
      // Default to "implementation" for backwards compatibility with older PRDs
      const storyType = nextStory.type || "implementation";

      // Build instructions based on story type
      let instructions: string;
      if (storyType === "research") {
        instructions = `This is a **RESEARCH** story. Analyze the codebase and output your findings as markdown directly in this chat. Do NOT create code files to store research - just output text findings. Mark complete when done.`;
      } else {
        instructions = `Create the branch if needed, implement the changes, run quality checks, and commit when done.`;
      }

      const messageText = `Continue with story **${nextStory.id}: ${nextStory.title}**

**Type:** ${storyType.toUpperCase()}

**Description:** ${nextStory.description}

**Acceptance Criteria:**
  - ${acceptanceCriteria}

${instructions} Remember to output \`<story-complete>${nextStory.id}</story-complete>\` when finished.`;

      console.log(
        "[ralph] Auto-starting - sending continue message for story:",
        nextStory.id,
      );

      // Send a message to start implementing the next story
      sendMessage({
        role: "user",
        parts: [
          {
            type: "text",
            text: messageText,
          },
        ],
      });
    }
  }, [
    myPendingAutoStart,
    isStreaming,
    sendMessage,
    subChatId,
    ralphState?.nextStory,
    ralphState?.hasPrd,
  ]);

  return {
    ralphSetupOpen,
    setRalphSetupOpen,
    ralphState,
  };
}
