"use client";

import { useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpcClient } from "../../../lib/trpc";
import { pendingPrMessageAtom, pendingReviewMessageAtom } from "../atoms";
import {
  generateCommitToPrMessage,
  generatePrMessage,
  generateReviewMessage,
} from "../utils/pr-message";

export interface UsePrActionsOptions {
  chatId: string;
}

export interface UsePrActionsReturn {
  // Loading states
  isCreatingPr: boolean;
  isCommittingToPr: boolean;
  isReviewing: boolean;
  // Actions
  handleCreatePr: () => Promise<void>;
  handleCommitToPr: () => Promise<void>;
  handleReview: () => Promise<void>;
}

export function usePrActions({
  chatId,
}: UsePrActionsOptions): UsePrActionsReturn {
  // Loading states
  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [isCommittingToPr, setIsCommittingToPr] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // Atoms for sending messages to Claude
  const setPendingPrMessage = useSetAtom(pendingPrMessageAtom);
  const setPendingReviewMessage = useSetAtom(pendingReviewMessageAtom);

  // Handle Create PR - sends a message to Claude to create the PR
  const handleCreatePr = useCallback(async () => {
    if (!chatId) {
      toast.error("Chat ID is required", { position: "top-center" });
      return;
    }

    setIsCreatingPr(true);
    try {
      // Get PR context from backend
      const context = await trpcClient.chats.getPrContext.query({ chatId });
      if (!context) {
        toast.error("Could not get git context", { position: "top-center" });
        return;
      }

      // Generate message and set it for ChatViewInner to send
      const message = generatePrMessage(context);
      setPendingPrMessage(message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to prepare PR request",
        { position: "top-center" },
      );
    } finally {
      setIsCreatingPr(false);
    }
  }, [chatId, setPendingPrMessage]);

  // Handle Commit to existing PR - sends a message to Claude to commit and push
  const handleCommitToPr = useCallback(async () => {
    if (!chatId) {
      toast.error("Chat ID is required", { position: "top-center" });
      return;
    }

    try {
      setIsCommittingToPr(true);
      const context = await trpcClient.chats.getPrContext.query({ chatId });
      if (!context) {
        toast.error("Could not get git context", { position: "top-center" });
        return;
      }

      const message = generateCommitToPrMessage(context);
      setPendingPrMessage(message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to prepare commit request",
        { position: "top-center" },
      );
    } finally {
      setIsCommittingToPr(false);
    }
  }, [chatId, setPendingPrMessage]);

  // Handle Review - sends a message to Claude to review the diff
  const handleReview = useCallback(async () => {
    if (!chatId) {
      toast.error("Chat ID is required", { position: "top-center" });
      return;
    }

    setIsReviewing(true);
    try {
      // Get PR context from backend
      const context = await trpcClient.chats.getPrContext.query({ chatId });
      if (!context) {
        toast.error("Could not get git context", { position: "top-center" });
        return;
      }

      // Generate review message and set it for ChatViewInner to send
      const message = generateReviewMessage(context);
      setPendingReviewMessage(message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start review",
        { position: "top-center" },
      );
    } finally {
      setIsReviewing(false);
    }
  }, [chatId, setPendingReviewMessage]);

  return {
    isCreatingPr,
    isCommittingToPr,
    isReviewing,
    handleCreatePr,
    handleCommitToPr,
    handleReview,
  };
}
