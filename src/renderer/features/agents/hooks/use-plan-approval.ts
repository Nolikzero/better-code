"use client";

import type { Chat } from "@ai-sdk/react";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { pendingPlanApprovalsAtom } from "../atoms";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

export interface UsePlanApprovalOptions {
  subChatId: string;
  messages: Chat<any>["messages"];
  sendMessage: Chat<any>["sendMessage"];
  isStreaming: boolean;
  setAgentMode: (mode: "plan" | "agent" | "ralph") => void;
}

export interface UsePlanApprovalReturn {
  hasUnapprovedPlan: boolean;
  handleApprovePlan: () => void;
}

/**
 * Hook to manage plan approval workflows including:
 * - Detection of unapproved plans (ExitPlanMode without "Implement plan")
 * - Keyboard shortcut (Cmd+Enter) to approve plans
 * - Updating pending plan approvals atom for sidebar indicators
 * - Cleanup on unmount
 */
export function usePlanApproval(
  options: UsePlanApprovalOptions,
): UsePlanApprovalReturn {
  const { subChatId, messages, sendMessage, isStreaming, setAgentMode } =
    options;

  // Check if there's an unapproved plan (ExitPlanMode without subsequent "Implement plan")
  const hasUnapprovedPlan = useMemo(() => {
    // If the latest assistant message is an ExitPlanMode with a plan, it's unapproved
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    if (lastMsg && lastMsg.role === "assistant") {
      const exitPlanPart = lastMsg.parts?.find(
        (p: any) => p.type === "tool-ExitPlanMode",
      );
      if (exitPlanPart?.output?.plan) {
        return true;
      }
    }
    return false;
  }, [messages]);

  // Update pending plan approvals atom for sidebar indicators
  const setPendingPlanApprovals = useSetAtom(pendingPlanApprovalsAtom);
  useEffect(() => {
    setPendingPlanApprovals((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (hasUnapprovedPlan) {
        newSet.add(subChatId);
      } else {
        newSet.delete(subChatId);
      }
      // Only return new set if it changed
      if (
        newSet.size !== prev.size ||
        ![...newSet].every((id) => prev.has(id))
      ) {
        return newSet;
      }
      return prev;
    });
  }, [hasUnapprovedPlan, subChatId, setPendingPlanApprovals]);

  // Handle plan approval - sends "Implement plan" message and switches to agent mode
  const handleApprovePlan = useCallback(() => {
    // Update store mode synchronously BEFORE sending (transport reads from store)
    useAgentSubChatStore.getState().updateSubChatMode(subChatId, "agent");

    // Update React state (for UI)
    setAgentMode("agent");

    // Send "Implement plan" message (now in agent mode)
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: "Implement plan" }],
    });
  }, [subChatId, setAgentMode, sendMessage]);

  // Keyboard shortcut: Cmd+Enter to approve plan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        e.metaKey &&
        !e.shiftKey &&
        hasUnapprovedPlan &&
        !isStreaming
      ) {
        e.preventDefault();
        handleApprovePlan();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnapprovedPlan, isStreaming, handleApprovePlan]);

  // Clean up pending plan approval when unmounting
  useEffect(() => {
    return () => {
      setPendingPlanApprovals((prev: Set<string>) => {
        if (prev.has(subChatId)) {
          const newSet = new Set(prev);
          newSet.delete(subChatId);
          return newSet;
        }
        return prev;
      });
    };
  }, [subChatId, setPendingPlanApprovals]);

  return {
    hasUnapprovedPlan,
    handleApprovePlan,
  };
}
