"use client";

import { memo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card";
import { cn } from "../../../lib/utils";

export interface AgentMessageMetadata {
  sessionId?: string;
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  finalTextId?: string;
  durationMs?: number;
  resultSubtype?: string;
}

interface AgentMessageUsageProps {
  metadata?: AgentMessageMetadata;
  isStreaming?: boolean;
  isMobile?: boolean;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} 毫秒`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes} 分钟 ${remainingSeconds} 秒`;
}

export const AgentMessageUsage = memo(function AgentMessageUsage({
  metadata,
  isStreaming = false,
  isMobile: _isMobile = false,
}: AgentMessageUsageProps) {
  if (!metadata || isStreaming) return null;

  const {
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = 0,
    durationMs,
    resultSubtype,
  } = metadata;

  const hasUsage = inputTokens > 0 || outputTokens > 0;

  if (!hasUsage) return null;

  const displayTokens = totalTokens || inputTokens + outputTokens;

  return (
    <HoverCard openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          tabIndex={-1}
          className={cn(
            "h-5 px-1.5 flex items-center text-[10px] rounded-md",
            "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50",
            "transition-[background-color,transform] duration-150 ease-out",
          )}
        >
          <span className="font-mono">{formatTokens(displayTokens)}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        sideOffset={4}
        align="end"
        className="w-auto pt-2 px-2 pb-0 shadow-xs rounded-lg border-border/50 overflow-hidden"
      >
        <div className="space-y-1.5 pb-2">
          {/* Status & Duration group */}
          {(resultSubtype || (durationMs !== undefined && durationMs > 0)) && (
            <div className="space-y-1">
              {resultSubtype && (
                <div className="flex justify-between text-xs gap-4">
                  <span className="text-muted-foreground">状态：</span>
                  <span className="font-mono text-foreground">
                    {resultSubtype === "success" ? "成功" : "失败"}
                  </span>
                </div>
              )}

              {durationMs !== undefined && durationMs > 0 && (
                <div className="flex justify-between text-xs gap-4">
                  <span className="text-muted-foreground">时长：</span>
                  <span className="font-mono text-foreground">
                    {formatDuration(durationMs)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tokens group */}
          {displayTokens > 0 && (
            <div className="flex justify-between text-xs gap-4 pt-1.5 mt-1 border-t border-border/50">
              <span className="text-muted-foreground">令牌：</span>
              <span className="font-mono font-medium text-foreground">
                {displayTokens.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});
