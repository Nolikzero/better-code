"use client";

import type { Chat } from "@ai-sdk/react";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { appStore } from "../../../lib/jotai-store";
import { trpc } from "../../../lib/trpc";
import { ralphInjectedPromptsAtom } from "../atoms";

export interface UseRalphAutoStartOptions {
  subChatId: string;
  agentMode: "plan" | "agent" | "ralph";
  messages: Chat<any>["messages"];
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
 * Hook to manage Ralph PRD UI workflows:
 * - Loading Ralph state (PRD existence, next story) for UI display
 * - Auto-opening setup dialog when switching to Ralph mode without PRD
 * - Injecting modified prompts into chat messages for display
 *
 * Note: Auto-continuation between stories is handled entirely on the backend
 * via the RalphOrchestrator continuation loop in the chat subscription.
 */
export function useRalphAutoStart(
  options: UseRalphAutoStartOptions,
): UseRalphAutoStartReturn {
  const { subChatId, agentMode, messages, setMessages } = options;

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

  return {
    ralphSetupOpen,
    setRalphSetupOpen,
    ralphState,
  };
}
