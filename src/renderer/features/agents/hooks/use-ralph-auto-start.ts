"use client";

import type { Chat } from "@ai-sdk/react";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { appStore } from "../../../lib/jotai-store";
import { trpc } from "../../../lib/trpc";
import { pendingRalphAutoStartsAtom, ralphInjectedPromptsAtom } from "../atoms";

export interface UseRalphAutoStartOptions {
  subChatId: string;
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
 * Hook to manage Ralph PRD workflows:
 * - Loading Ralph state (PRD existence, next story) for UI display
 * - Auto-opening setup dialog when switching to Ralph mode without PRD
 * - Injecting modified prompts into chat messages for display
 * - Auto-continuing to next story after stream ends (driven by backend signal)
 */
export function useRalphAutoStart(
  options: UseRalphAutoStartOptions,
): UseRalphAutoStartReturn {
  const {
    subChatId,
    agentMode,
    isStreaming,
    messages,
    sendMessage,
    setMessages,
  } = options;

  // Ralph state query - to check if PRD exists for showing setup dialog
  const { data: ralphState } = trpc.ralph.getState.useQuery(
    { subChatId },
    { enabled: !!subChatId && agentMode === "ralph" },
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

  // Auto-continue to next story when backend signals and stream has ended
  const pendingRalphAutoStarts = useAtomValue(pendingRalphAutoStartsAtom);
  const myPendingAutoStart = pendingRalphAutoStarts.get(subChatId) ?? null;

  useEffect(() => {
    // Only auto-start when:
    // 1. There's a pending auto-start for this sub-chat
    // 2. Not currently streaming (stream has ended with "finish")
    if (!myPendingAutoStart || isStreaming) return;

    // Clear immediately to prevent double-sends
    const updated = new Map(appStore.get(pendingRalphAutoStartsAtom));
    updated.delete(subChatId);
    appStore.set(pendingRalphAutoStartsAtom, updated);

    const { continuationMessage, nextStoryId } = myPendingAutoStart;

    console.log(
      "[ralph] Auto-starting story:",
      nextStoryId,
      "with pre-built message",
    );

    // Send the continuation as a new user message (new turn, new stream)
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: continuationMessage }],
    });
  }, [myPendingAutoStart, isStreaming, sendMessage, subChatId]);

  return {
    ralphSetupOpen,
    setRalphSetupOpen,
    ralphState,
  };
}
