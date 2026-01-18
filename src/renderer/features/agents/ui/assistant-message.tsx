"use client";

import { motion } from "motion/react";
import { ChatMarkdownRenderer } from "../../../components/chat-markdown-renderer";
import { cn } from "../../../lib/utils";
import {
  copyMessageContent,
  getMessageTextContent,
  groupExploringTools,
} from "../utils/message-utils";
import { AgentAskUserQuestionTool } from "./agent-ask-user-question-tool";
import { AgentBashTool } from "./agent-bash-tool";
import { AgentEditTool } from "./agent-edit-tool";
import { AgentExitPlanModeTool } from "./agent-exit-plan-mode-tool";
import { AgentExploringGroup } from "./agent-exploring-group";
import {
  type AgentMessageMetadata,
  AgentMessageUsage,
} from "./agent-message-usage";
import { AgentPlanTool } from "./agent-plan-tool";
import { AgentTaskTool } from "./agent-task-tool";
import { AgentThinkingTool } from "./agent-thinking-tool";
import { AgentTodoTool } from "./agent-todo-tool";
import { AgentToolCall } from "./agent-tool-call";
import { AgentToolRegistry, getToolStatus } from "./agent-tool-registry";
import { AgentWebFetchTool } from "./agent-web-fetch-tool";
import { AgentWebSearchCollapsible } from "./agent-web-search-collapsible";
import { CollapsibleSteps } from "./collapsible-steps";
import { CopyButton, PlayButton, type PlaybackSpeed } from "./message-controls";

// Message type matching useChat().messages - parts have dynamic tool types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AssistantMessageType = {
  id: string;
  role: string;
  parts?: any[];
  metadata?: any;
};

export interface AssistantMessageProps {
  message: AssistantMessageType;
  isLastMessage: boolean;
  isStreaming: boolean;
  status: string;
  subChatId: string;
  sandboxSetupStatus?: "cloning" | "ready" | "error";
  isMobile?: boolean;
  ttsPlaybackRate: PlaybackSpeed;
  onPlaybackRateChange: (rate: PlaybackSpeed) => void;
}

export function AssistantMessage({
  message: assistantMsg,
  isLastMessage,
  isStreaming,
  status,
  subChatId,
  sandboxSetupStatus = "ready",
  isMobile = false,
  ttsPlaybackRate,
  onPlaybackRateChange,
}: AssistantMessageProps) {
  // Assistant message - flat layout, no bubble (like Canvas)
  const contentParts =
    assistantMsg.parts?.filter((p: any) => p.type !== "step-start") || [];

  // Show planning when streaming but no content yet (like Canvas)
  // Only show after sandbox is ready
  const shouldShowPlanning =
    sandboxSetupStatus === "ready" &&
    isStreaming &&
    isLastMessage &&
    contentParts.length === 0;

  // Check if message has text content (for copy button)
  const hasTextContent = assistantMsg.parts?.some(
    (p: any) => p.type === "text" && p.text?.trim(),
  );

  // Build map of nested tools per parent Task
  const nestedToolsMap = new Map<string, any[]>();
  const nestedToolIds = new Set<string>();
  const taskPartIds = new Set(
    (assistantMsg.parts || [])
      .filter((p: any) => p.type === "tool-Task" && p.toolCallId)
      .map((p: any) => p.toolCallId),
  );
  const orphanTaskGroups = new Map<
    string,
    { parts: any[]; firstToolCallId: string }
  >();
  const orphanToolCallIds = new Set<string>();
  const orphanFirstToolCallIds = new Set<string>();

  for (const part of assistantMsg.parts || []) {
    if (part.toolCallId?.includes(":")) {
      const parentId = part.toolCallId.split(":")[0];
      if (taskPartIds.has(parentId)) {
        if (!nestedToolsMap.has(parentId)) {
          nestedToolsMap.set(parentId, []);
        }
        nestedToolsMap.get(parentId)!.push(part);
        nestedToolIds.add(part.toolCallId);
      } else {
        let group = orphanTaskGroups.get(parentId);
        if (!group) {
          group = {
            parts: [],
            firstToolCallId: part.toolCallId,
          };
          orphanTaskGroups.set(parentId, group);
          orphanFirstToolCallIds.add(part.toolCallId);
        }
        group.parts.push(part);
        orphanToolCallIds.add(part.toolCallId);
      }
    }
  }

  // Detect final text by structure: last text part after any tool parts
  // This works locally without needing metadata.finalTextId
  const allParts = assistantMsg.parts || [];

  // Find the last tool index and last text index
  let lastToolIndex = -1;
  let lastTextIndex = -1;
  for (let i = 0; i < allParts.length; i++) {
    const part = allParts[i];
    if (part.type?.startsWith("tool-")) {
      lastToolIndex = i;
    }
    if (part.type === "text" && part.text?.trim()) {
      lastTextIndex = i;
    }
  }

  // Final text exists if: there are tools AND the last text comes AFTER the last tool
  // For streaming messages, don't show as final until streaming completes
  const hasToolsAndFinalText =
    lastToolIndex !== -1 && lastTextIndex > lastToolIndex;

  const finalTextIndex = hasToolsAndFinalText ? lastTextIndex : -1;

  // Separate parts into steps (before final) and final text
  // For non-last messages, show final text even while streaming (they're already complete)
  const hasFinalText =
    finalTextIndex !== -1 && (!isStreaming || !isLastMessage);

  // Check if message has a plan (ExitPlanMode tool)
  const exitPlanPart = allParts.find(
    (p: any) => p.type === "tool-ExitPlanMode",
  );
  const planText =
    typeof exitPlanPart?.output?.plan === "string"
      ? exitPlanPart.output.plan
      : "";
  const hasPlan = !!planText;

  // If has plan, treat everything before plan as steps to collapse
  const stepParts = hasFinalText
    ? (assistantMsg.parts || []).slice(0, finalTextIndex)
    : hasPlan
      ? allParts.filter((p: any) => p.type !== "tool-ExitPlanMode") // All parts except plan are steps
      : [];
  const finalParts = hasFinalText
    ? (assistantMsg.parts || []).slice(finalTextIndex)
    : hasPlan
      ? [] // Plan is rendered separately, no final parts
      : assistantMsg.parts || [];

  // Count visible step items (for the toggle label)
  const visibleStepsCount = stepParts.filter((p: any) => {
    if (p.type === "step-start") return false;
    if (p.type === "tool-TaskOutput") return false;
    if (p.toolCallId && nestedToolIds.has(p.toolCallId)) return false;
    if (
      p.toolCallId &&
      orphanToolCallIds.has(p.toolCallId) &&
      !orphanFirstToolCallIds.has(p.toolCallId)
    )
      return false;
    if (p.type === "text" && !p.text?.trim()) return false;
    return true;
  }).length;

  // Helper function to render a single part
  const renderPart = (part: any, idx: number, isFinal = false) => {
    // Skip step-start parts
    if (part.type === "step-start") {
      return null;
    }

    // Skip TaskOutput - internal tool with meta info not useful for UI
    if (part.type === "tool-TaskOutput") {
      return null;
    }

    if (part.toolCallId && orphanToolCallIds.has(part.toolCallId)) {
      if (!orphanFirstToolCallIds.has(part.toolCallId)) {
        return null;
      }
      const parentId = part.toolCallId.split(":")[0];
      const group = orphanTaskGroups.get(parentId);
      if (group) {
        return (
          <AgentTaskTool
            key={idx}
            part={{
              type: "tool-Task",
              toolCallId: parentId,
              input: {
                subagent_type: "unknown-agent",
                description: "Incomplete task",
              },
            }}
            nestedTools={group.parts}
            chatStatus={status}
          />
        );
      }
    }

    // Skip nested tools - they're rendered within their parent Task
    if (part.toolCallId && nestedToolIds.has(part.toolCallId)) {
      return null;
    }

    // Exploring group - grouped Read/Grep/Glob tools
    // NOTE: isGroupStreaming is calculated in the map() call below
    // because we need to know if this is the last element
    if (part.type === "exploring-group") {
      return null; // Handled separately in map with isLast info
    }

    // Text parts - with px-2 like Canvas
    if (part.type === "text") {
      if (!part.text?.trim()) return null;
      // Check if this is the final text by comparing index (parts don't have IDs)
      const isFinalText = isFinal && idx === finalTextIndex;

      return (
        <div
          key={idx}
          className={cn(
            "text-foreground px-2",
            // Only show Summary styling if there are steps to collapse
            isFinalText &&
              visibleStepsCount > 0 &&
              "pt-3 border-t border-border/50",
          )}
        >
          {/* Only show Summary label if there are steps to collapse */}
          {isFinalText && visibleStepsCount > 0 && (
            <div className="text-[12px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1">
              Response
            </div>
          )}
          <ChatMarkdownRenderer content={part.text} size="sm" />
        </div>
      );
    }

    // Special handling for tool-Task - render with nested tools
    if (part.type === "tool-Task") {
      const nestedTools = nestedToolsMap.get(part.toolCallId) || [];
      return (
        <AgentTaskTool
          key={idx}
          part={part}
          nestedTools={nestedTools}
          chatStatus={status}
        />
      );
    }

    // Special handling for tool-Bash - render with full command and output
    if (part.type === "tool-Bash") {
      return <AgentBashTool key={idx} part={part} chatStatus={status} />;
    }

    // Special handling for tool-Thinking - Extended Thinking
    if (part.type === "tool-Thinking") {
      return <AgentThinkingTool key={idx} part={part} chatStatus={status} />;
    }

    // Special handling for tool-Edit - render with file icon and diff stats
    if (part.type === "tool-Edit") {
      return <AgentEditTool key={idx} part={part} chatStatus={status} />;
    }

    // Special handling for tool-Write - render with file preview (reuses AgentEditTool)
    if (part.type === "tool-Write") {
      return <AgentEditTool key={idx} part={part} chatStatus={status} />;
    }

    // Special handling for tool-WebSearch - collapsible results list
    if (part.type === "tool-WebSearch") {
      return (
        <AgentWebSearchCollapsible key={idx} part={part} chatStatus={status} />
      );
    }

    // Special handling for tool-WebFetch - expandable content preview
    if (part.type === "tool-WebFetch") {
      return <AgentWebFetchTool key={idx} part={part} chatStatus={status} />;
    }

    // Special handling for tool-PlanWrite - plan with steps
    if (part.type === "tool-PlanWrite") {
      return <AgentPlanTool key={idx} part={part} chatStatus={status} />;
    }

    // Special handling for tool-ExitPlanMode - show simple indicator inline
    // Full plan card is rendered at end of message
    if (part.type === "tool-ExitPlanMode") {
      const { isPending, isError } = getToolStatus(part, status);
      return (
        <AgentToolCall
          key={idx}
          icon={AgentToolRegistry["tool-ExitPlanMode"].icon}
          title={AgentToolRegistry["tool-ExitPlanMode"].title(part)}
          isPending={isPending}
          isError={isError}
        />
      );
    }

    // Special handling for tool-TodoWrite - todo list with progress
    // All todos render inline - sticky behavior is handled by IntersectionObserver
    if (part.type === "tool-TodoWrite") {
      return (
        <AgentTodoTool
          key={idx}
          part={part}
          chatStatus={status}
          subChatId={subChatId}
        />
      );
    }

    // Special handling for tool-AskUserQuestion
    if (part.type === "tool-AskUserQuestion") {
      const { isPending, isError } = getToolStatus(part, status);
      return (
        <AgentAskUserQuestionTool
          key={idx}
          input={part.input}
          result={part.result}
          errorText={(part as any).errorText || (part as any).error}
          state={isPending ? "call" : "result"}
          isError={isError}
          isStreaming={isStreaming && isLastMessage}
          toolCallId={part.toolCallId}
        />
      );
    }

    // Tool parts - check registry
    if (part.type in AgentToolRegistry) {
      const meta = AgentToolRegistry[part.type];
      const { isPending, isError } = getToolStatus(part, status);
      return (
        <AgentToolCall
          key={idx}
          icon={meta.icon}
          title={meta.title(part)}
          subtitle={meta.subtitle?.(part)}
          isPending={isPending}
          isError={isError}
        />
      );
    }

    // Fallback for unknown tool types
    if (part.type?.startsWith("tool-")) {
      return (
        <div key={idx} className="text-xs text-muted-foreground py-0.5 px-2">
          {part.type.replace("tool-", "")}
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      data-assistant-message-id={assistantMsg.id}
      className="group/message w-full mb-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
    >
      <div className="flex flex-col gap-1.5">
        {/* Collapsible steps section - show when we have final text OR a plan */}
        {(hasFinalText || hasPlan) && visibleStepsCount > 0 && (
          <CollapsibleSteps stepsCount={visibleStepsCount}>
            {(() => {
              const grouped = groupExploringTools(stepParts, nestedToolIds);
              return grouped.map((part: any, idx: number) => {
                // Handle exploring-group with isLast check
                if (part.type === "exploring-group") {
                  const isLast = idx === grouped.length - 1;
                  const isGroupStreaming =
                    isStreaming && isLastMessage && isLast;
                  return (
                    <AgentExploringGroup
                      key={idx}
                      parts={part.parts}
                      chatStatus={status}
                      isStreaming={isGroupStreaming}
                    />
                  );
                }
                return renderPart(part, idx, false);
              });
            })()}
          </CollapsibleSteps>
        )}

        {/* Final parts (or all parts if no final text yet) */}
        {(() => {
          const grouped = groupExploringTools(finalParts, nestedToolIds);
          return grouped.map((part: any, idx: number) => {
            // Handle exploring-group with isLast check
            if (part.type === "exploring-group") {
              const isLast = idx === grouped.length - 1;
              const isGroupStreaming = isStreaming && isLastMessage && isLast;
              return (
                <AgentExploringGroup
                  key={idx}
                  parts={part.parts}
                  chatStatus={status}
                  isStreaming={isGroupStreaming}
                />
              );
            }
            return renderPart(
              part,
              hasFinalText ? finalTextIndex + idx : idx,
              hasFinalText,
            );
          });
        })()}

        {/* Plan card at end of message - if ExitPlanMode tool has plan content */}
        {hasPlan && exitPlanPart && (
          <AgentExitPlanModeTool part={exitPlanPart} chatStatus={status} />
        )}

        {/* Planning indicator - like Canvas */}
        {shouldShowPlanning && (
          <AgentToolCall
            icon={AgentToolRegistry["tool-planning"].icon}
            title={AgentToolRegistry["tool-planning"].title({})}
            isPending={true}
            isError={false}
          />
        )}
      </div>

      {/* Copy, Play, and Usage buttons bar - shows on hover (always visible on mobile) */}
      {(hasTextContent || hasPlan) && (!isStreaming || !isLastMessage) && (
        <div className="flex justify-between items-center h-6 px-2 mt-1">
          <div className="flex items-center gap-0.5">
            <CopyButton
              onCopy={() => {
                // If has plan, copy plan text; otherwise copy message content
                if (hasPlan) {
                  navigator.clipboard.writeText(planText);
                } else {
                  copyMessageContent(assistantMsg);
                }
              }}
              isMobile={isMobile}
            />
            {/* Play button - plays plan if exists, otherwise final text or full message */}
            <PlayButton
              text={
                hasPlan
                  ? planText
                  : hasFinalText
                    ? allParts[finalTextIndex]?.text || ""
                    : getMessageTextContent(assistantMsg)
              }
              isMobile={isMobile}
              playbackRate={ttsPlaybackRate}
              onPlaybackRateChange={onPlaybackRateChange}
            />
          </div>
          {/* Token usage info - right side */}
          <AgentMessageUsage
            metadata={assistantMsg.metadata as AgentMessageMetadata}
            isStreaming={isStreaming}
            isMobile={isMobile}
          />
        </div>
      )}
    </motion.div>
  );
}
