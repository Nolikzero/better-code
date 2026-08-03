"use client";

import type { BuiltinAgentId } from "@shared/builtin-agents";
import { useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "../../../lib/trpc";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

type UseBuiltinAgentSelectionOptions = {
  readonly subChatId: string;
};

type UseBuiltinAgentSelectionReturn = {
  readonly builtinAgentId: BuiltinAgentId | null;
  readonly isBuiltinAgentUpdating: boolean;
  readonly handleBuiltinAgentChange: (agentId: BuiltinAgentId | null) => void;
};

export function useBuiltinAgentSelection({
  subChatId,
}: UseBuiltinAgentSelectionOptions): UseBuiltinAgentSelectionReturn {
  const builtinAgentId = useAgentSubChatStore((state) => {
    return (
      state.allSubChats.find((subChat) => subChat.id === subChatId)?.agentId ??
      null
    );
  });
  const updateSubChatAgentMutation =
    trpc.chats.updateSubChatAgent.useMutation();

  const handleBuiltinAgentChange = useCallback(
    (nextAgentId: BuiltinAgentId | null) => {
      const store = useAgentSubChatStore.getState();
      const previousAgentId =
        store.allSubChats.find((subChat) => subChat.id === subChatId)
          ?.agentId ?? null;

      if (previousAgentId === nextAgentId) return;

      store.updateSubChatAgent(subChatId, nextAgentId);
      if (subChatId.startsWith("temp-")) return;

      updateSubChatAgentMutation.mutate(
        { id: subChatId, agentId: nextAgentId },
        {
          onError: () => {
            const currentAgentId =
              useAgentSubChatStore
                .getState()
                .allSubChats.find((subChat) => subChat.id === subChatId)
                ?.agentId ?? null;
            if (currentAgentId === nextAgentId) {
              useAgentSubChatStore
                .getState()
                .updateSubChatAgent(subChatId, previousAgentId);
            }
            toast.error("智能体设置保存失败，已恢复原设置");
          },
        },
      );
    },
    [subChatId, updateSubChatAgentMutation],
  );

  return {
    builtinAgentId,
    isBuiltinAgentUpdating: updateSubChatAgentMutation.isPending,
    handleBuiltinAgentChange,
  };
}
