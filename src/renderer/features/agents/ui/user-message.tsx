"use client";

import { motion } from "motion/react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { AgentToolCall } from "./agent-tool-call";
import { AgentToolRegistry } from "./agent-tool-registry";
import { AgentUserMessageBubble } from "./agent-user-message-bubble";

// Layout constants for chat header and sticky messages
export const CHAT_LAYOUT = {
  // Padding top for chat content
  paddingTopSidebarOpen: "pt-12", // When sidebar open (absolute header overlay)
  paddingTopSidebarClosed: "pt-4", // When sidebar closed (regular header)
  paddingTopMobile: "pt-14", // Mobile has header
  // Sticky message top position (title is now in flex above scroll, so top-0)
  stickyTopSidebarOpen: "top-0", // When sidebar open (desktop, absolute header)
  stickyTopSidebarClosed: "top-0", // When sidebar closed (desktop, flex header)
  stickyTopMobile: "top-0", // Mobile (flex header, so top-0)
  // Header padding when absolute
  headerPaddingSidebarOpen: "pt-1.5 pb-12 px-3 pl-2",
  headerPaddingSidebarClosed: "p-2 pt-1.5",
} as const;

// Message type matching useChat().messages
type UserMessageType = {
  id: string;
  role: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts?: any[];
};

export interface UserMessageProps {
  message: UserMessageType;
  isLastUserMessage: boolean;
  sandboxSetupStatus: "cloning" | "ready" | "error";
  sandboxSetupError?: string;
  onRetrySetup?: () => void;
  hasAssistantResponse: boolean;
  isMobile?: boolean;
  isSubChatsSidebarOpen?: boolean;
}

export function UserMessage({
  message: msg,
  isLastUserMessage,
  sandboxSetupStatus,
  sandboxSetupError,
  onRetrySetup,
  hasAssistantResponse,
  isMobile = false,
  isSubChatsSidebarOpen = false,
}: UserMessageProps) {
  // User message data
  const textContent = msg.parts
    ?.filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("\n");

  const imageParts =
    msg.parts?.filter((p: any) => p.type === "data-image") || [];

  // Show cloning when sandbox is being set up (only for last user message with no responses)
  const shouldShowCloning =
    sandboxSetupStatus === "cloning" &&
    isLastUserMessage &&
    !hasAssistantResponse;

  // Show setup error if sandbox setup failed
  const shouldShowSetupError =
    sandboxSetupStatus === "error" &&
    isLastUserMessage &&
    !hasAssistantResponse;

  return (
    <>
      {/* Attachments - NOT sticky, scroll normally */}
      {imageParts.length > 0 && (
        <motion.div
          className="mb-2 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
        >
          <AgentUserMessageBubble
            messageId={msg.id}
            textContent=""
            imageParts={imageParts}
          />
        </motion.div>
      )}
      {/* User message text - sticky WITHIN this group */}
      <div
        data-user-message-id={msg.id}
        className={cn(
          "[&>div]:!mb-4 pointer-events-auto",
          // Sticky within the group container
          // No z-index here to avoid blocking dropdowns/tooltips
          "sticky",
          isMobile
            ? CHAT_LAYOUT.stickyTopMobile
            : isSubChatsSidebarOpen
              ? CHAT_LAYOUT.stickyTopSidebarOpen
              : CHAT_LAYOUT.stickyTopSidebarClosed,
        )}
      >
        <AgentUserMessageBubble
          messageId={msg.id}
          textContent={textContent || ""}
          imageParts={[]}
        />
        {/* Cloning indicator - shown while sandbox is being set up */}
        {shouldShowCloning && (
          <div className="mt-4">
            <AgentToolCall
              icon={AgentToolRegistry["tool-cloning"].icon}
              title={AgentToolRegistry["tool-cloning"].title({})}
              isPending={true}
              isError={false}
            />
          </div>
        )}
        {/* Setup error with retry */}
        {shouldShowSetupError && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <span>
                Failed to set up sandbox
                {sandboxSetupError ? `: ${sandboxSetupError}` : ""}
              </span>
              {onRetrySetup && (
                <Button variant="ghost" size="sm" onClick={onRetrySetup}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
