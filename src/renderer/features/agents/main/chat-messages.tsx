"use client";
import { useEffect, useMemo, useRef } from "react";
import { AgentToolCall } from "../ui/agent-tool-call";
import { AgentToolRegistry } from "../ui/agent-tool-registry";
import { AssistantMessage } from "../ui/assistant-message";
import type { PlaybackSpeed } from "../ui/message-controls";
import { UserMessage } from "../ui/user-message";

// Message type matching useChat().messages
type MessageType = {
  id: string;
  role: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
};

// Message group wrapper - measures user message height for sticky todo positioning
interface MessageGroupProps {
  children: React.ReactNode;
}

function MessageGroup({ children }: MessageGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const userMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const groupEl = groupRef.current;
    if (!groupEl) return;

    // Find the actual bubble element (not the wrapper which includes gradient)
    const bubbleEl = groupEl.querySelector(
      "[data-user-bubble]",
    ) as HTMLDivElement | null;
    if (!bubbleEl) return;

    userMessageRef.current = bubbleEl;

    const updateHeight = () => {
      const height = bubbleEl.offsetHeight;
      // Set CSS variable directly on DOM - no React state, no re-renders
      groupEl.style.setProperty("--user-message-height", `${height}px`);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(bubbleEl);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={groupRef} className="relative">
      {children}
    </div>
  );
}

export interface ChatMessagesProps {
  messages: MessageType[];
  status: string;
  subChatId: string;
  sandboxSetupStatus: "cloning" | "ready" | "error";
  sandboxSetupError?: string;
  onRetrySetup?: () => void;
  isMobile?: boolean;
  isSubChatsSidebarOpen?: boolean;
  ttsPlaybackRate: PlaybackSpeed;
  onPlaybackRateChange: (rate: PlaybackSpeed) => void;
}

export function ChatMessages({
  messages,
  status,
  subChatId,
  sandboxSetupStatus,
  sandboxSetupError,
  onRetrySetup,
  isMobile = false,
  isSubChatsSidebarOpen = false,
  ttsPlaybackRate,
  onPlaybackRateChange,
}: ChatMessagesProps) {
  const isStreaming = status === "streaming" || status === "submitted";

  // Group messages into pairs: [userMsg, ...assistantMsgs]
  // Each group is a "conversation turn" where user message is sticky within the group
  const messageGroups = useMemo(() => {
    const groups: {
      userMsg: MessageType;
      assistantMsgs: MessageType[];
    }[] = [];
    let currentGroup: {
      userMsg: MessageType;
      assistantMsgs: MessageType[];
    } | null = null;

    for (const msg of messages) {
      if (msg.role === "user") {
        // Start a new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = { userMsg: msg, assistantMsgs: [] };
      } else if (currentGroup) {
        // Add assistant message to current group
        currentGroup.assistantMsgs.push(msg);
      }
    }

    // Push the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [messages]);

  return (
    <div className="px-2 max-w-2xl mx-auto -mb-4 pb-8 space-y-4">
      <div>
        {/* Render message groups - each group has user message sticky within it */}
        {messageGroups.map((group, groupIndex) => {
          const isLastUserMessage = groupIndex === messageGroups.length - 1;

          return (
            <MessageGroup key={group.userMsg.id}>
              <UserMessage
                message={group.userMsg}
                isLastUserMessage={isLastUserMessage}
                sandboxSetupStatus={sandboxSetupStatus}
                sandboxSetupError={sandboxSetupError}
                onRetrySetup={onRetrySetup}
                hasAssistantResponse={group.assistantMsgs.length > 0}
                isMobile={isMobile}
                isSubChatsSidebarOpen={isSubChatsSidebarOpen}
              />

              {/* Assistant messages in this group */}
              {group.assistantMsgs.map((assistantMsg) => {
                const isLastMessage =
                  assistantMsg.id === messages[messages.length - 1]?.id;

                return (
                  <AssistantMessage
                    key={assistantMsg.id}
                    message={assistantMsg}
                    isLastMessage={isLastMessage}
                    isStreaming={isStreaming}
                    status={status}
                    subChatId={subChatId}
                    sandboxSetupStatus={sandboxSetupStatus}
                    isMobile={isMobile}
                    ttsPlaybackRate={ttsPlaybackRate}
                    onPlaybackRateChange={onPlaybackRateChange}
                  />
                );
              })}

              {/* Planning indicator - shown when streaming starts but no assistant message yet */}
              {isStreaming &&
                isLastUserMessage &&
                group.assistantMsgs.length === 0 &&
                sandboxSetupStatus === "ready" && (
                  <div className="mt-4">
                    <AgentToolCall
                      icon={AgentToolRegistry["tool-planning"].icon}
                      title={AgentToolRegistry["tool-planning"].title({})}
                      isPending={true}
                      isError={false}
                    />
                  </div>
                )}
            </MessageGroup>
          );
        })}
      </div>
    </div>
  );
}
