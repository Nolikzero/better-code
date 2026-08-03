"use client";

import type { ProviderId } from "@shared/types";
import { useAtom } from "jotai";
import { ChevronRight, Loader2 } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { OriginalMCPIcon } from "../../../components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { type MCPServerStatus, sessionInfoAtom } from "../../../lib/atoms";
import { getProviderMcpHelp } from "../../../lib/provider-mcp";
import { trpc } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";

interface McpServersIndicatorProps {
  projectPath?: string;
  providerId?: ProviderId;
}

/**
 * MCP Servers Indicator
 *
 * Shows a badge with the count of connected MCP servers.
 * Clicking it opens a popover with:
 * - List of MCP servers with status (connected/failed/pending)
 * - Expandable servers showing their tools
 * - Provider-specific configuration guidance
 */
export const McpServersIndicator = memo(function McpServersIndicator({
  projectPath,
  providerId = "claude",
}: McpServersIndicatorProps) {
  const [sessionInfo, setSessionInfo] = useAtom(sessionInfoAtom);
  const queryProjectPath = projectPath ?? "";
  const mcpHelp = getProviderMcpHelp(providerId);

  // Fetch MCP config on mount if we have projectPath and no session info yet
  const { data: mcpConfig } = trpc.chat.getMcpConfig.useQuery(
    { projectPath: queryProjectPath, providerId },
    {
      enabled: !!projectPath && !sessionInfo?.mcpServers?.length,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Update sessionInfo with MCP config if we don't have it yet
  useEffect(() => {
    if (mcpConfig?.mcpServers?.length && !sessionInfo?.mcpServers?.length) {
      setSessionInfo((prev) => ({
        tools: prev?.tools || [],
        mcpServers: mcpConfig.mcpServers.map((s) => ({
          name: s.name,
          status: s.status,
        })),
        plugins: prev?.plugins || [],
        skills: prev?.skills || [],
      }));
    }
  }, [mcpConfig, sessionInfo?.mcpServers?.length, setSessionInfo]);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    new Set(),
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const serverButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Count connected servers
  const connectedCount = useMemo(() => {
    if (!sessionInfo?.mcpServers) return 0;
    return sessionInfo.mcpServers.filter((s) => s.status === "connected")
      .length;
  }, [sessionInfo?.mcpServers]);

  // Get tools grouped by MCP server
  const toolsByServer = useMemo(() => {
    if (!sessionInfo?.tools || !sessionInfo?.mcpServers) return new Map();

    const map = new Map<string, string[]>();

    // Initialize map with all servers
    for (const server of sessionInfo.mcpServers) {
      map.set(server.name, []);
    }

    // Group tools by server (format: mcp__servername__toolname)
    for (const tool of sessionInfo.tools) {
      if (!tool.startsWith("mcp__")) continue;
      const parts = tool.split("__");
      if (parts.length < 3) continue;
      const serverName = parts[1];
      const toolName = parts.slice(2).join("__"); // Handle tools with __ in name

      const serverTools = map.get(serverName) || [];
      serverTools.push(toolName);
      map.set(serverName, serverTools);
    }

    return map;
  }, [sessionInfo?.tools, sessionInfo?.mcpServers]);

  // Don't show if no session info or no MCP servers
  if (!sessionInfo?.mcpServers || sessionInfo.mcpServers.length === 0) {
    return null;
  }

  const toggleServer = (serverName: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  };

  const getStatusIcon = (status: MCPServerStatus) => {
    switch (status) {
      case "connected":
        return (
          <span
            className="w-2 h-2 rounded-full bg-green-500"
            aria-label="已连接"
          />
        );
      case "failed":
        return (
          <span
            className="w-2 h-2 rounded-full bg-red-500"
            aria-label="连接失败"
          />
        );
      case "needs-auth":
        return (
          <span
            className="w-2 h-2 rounded-full bg-yellow-500"
            aria-label="需要身份验证"
          />
        );
      case "pending":
        return (
          <Loader2
            className="w-3 h-3 text-muted-foreground animate-spin"
            aria-label="正在连接"
          />
        );
      default:
        return (
          <span
            className="w-2 h-2 rounded-full bg-muted-foreground/50"
            aria-label="未知状态"
          />
        );
    }
  };

  const getStatusText = (status: MCPServerStatus) => {
    switch (status) {
      case "connected":
        return "已连接";
      case "failed":
        return "连接失败";
      case "needs-auth":
        return "需要认证";
      case "pending":
        return "正在连接…";
      default:
        return status;
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const serverCount = sessionInfo.mcpServers.length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < serverCount - 1 ? prev + 1 : 0;
          serverButtonsRef.current[next]?.focus();
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : serverCount - 1;
          serverButtonsRef.current[next]?.focus();
          return next;
        });
        break;
      case "Enter":
      case " ":
        if (focusedIndex >= 0 && focusedIndex < serverCount) {
          const server = sessionInfo.mcpServers[focusedIndex];
          const hasTools = (toolsByServer.get(server.name) || []).length > 0;
          if (hasTools) {
            e.preventDefault();
            toggleServer(server.name);
          }
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md"
              aria-label="MCP 服务器"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
            >
              <OriginalMCPIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{connectedCount} MCP</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>已连接 {connectedCount} 个 MCP 服务器</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        className="w-72 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label="MCP 服务器"
      >
        <div className="px-3 py-2 border-b">
          <h4 className="font-medium text-sm" id="mcp-servers-title">
            MCP 服务器
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            模型上下文协议服务器
          </p>
        </div>

        <div
          className="max-h-64 overflow-y-auto py-1"
          role="list"
          aria-labelledby="mcp-servers-title"
        >
          {sessionInfo.mcpServers.map((server, index) => {
            const tools = toolsByServer.get(server.name) || [];
            const isExpanded = expandedServers.has(server.name);
            const hasTools = tools.length > 0;

            return (
              <div key={server.name} role="listitem">
                {/* Server row */}
                <button
                  ref={(el) => {
                    serverButtonsRef.current[index] = el;
                  }}
                  onClick={() => hasTools && toggleServer(server.name)}
                  onFocus={() => setFocusedIndex(index)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                    hasTools
                      ? "hover:bg-muted/50 cursor-pointer"
                      : "cursor-default",
                    focusedIndex === index && "bg-muted/50",
                  )}
                  aria-expanded={hasTools ? isExpanded : undefined}
                  aria-controls={hasTools ? `tools-${server.name}` : undefined}
                  tabIndex={0}
                  title={server.error || getStatusText(server.status)}
                >
                  {/* Expand/collapse chevron */}
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                      isExpanded && "rotate-90",
                      !hasTools && "opacity-0",
                    )}
                    aria-hidden="true"
                  />

                  {/* Status indicator */}
                  {getStatusIcon(server.status)}

                  {/* Server name and version */}
                  <div className="flex-1 min-w-0">
                    <span className="truncate block">{server.name}</span>
                    {server.serverInfo?.version && (
                      <span className="text-[10px] text-muted-foreground/70 truncate block">
                        v{server.serverInfo.version}
                      </span>
                    )}
                  </div>

                  {/* Tool count badge */}
                  {hasTools && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {tools.length} 个工具
                    </span>
                  )}
                </button>

                {/* Error message */}
                {server.error && (
                  <div
                    className="pl-10 pr-3 pb-1 text-[10px] text-red-500/80 truncate"
                    title={server.error}
                  >
                    {server.error}
                  </div>
                )}

                {/* Tools list (expanded) */}
                {isExpanded && hasTools && (
                  <div
                    id={`tools-${server.name}`}
                    className="pl-8 pr-3 py-1 space-y-0.5"
                    role="list"
                    aria-label={`${server.name} 的工具`}
                  >
                    {tools.map((tool: string) => (
                      <div
                        key={tool}
                        className="text-xs text-muted-foreground py-0.5 truncate"
                        title={tool}
                        role="listitem"
                      >
                        {tool}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Plugins section */}
        {sessionInfo.plugins && sessionInfo.plugins.length > 0 && (
          <>
            <div className="border-t px-3 py-2">
              <h4 className="font-medium text-sm" id="plugins-title">
                插件
              </h4>
            </div>
            <div className="pb-1" role="list" aria-labelledby="plugins-title">
              {sessionInfo.plugins.map((plugin) => (
                <div
                  key={plugin.path}
                  className="px-3 py-1.5 text-sm flex items-center gap-2"
                  role="listitem"
                >
                  <span
                    className="w-2 h-2 rounded-full bg-green-500"
                    aria-label="启用"
                  />
                  <span className="truncate">{plugin.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer with config hint */}
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          请通过以下方式配置：{" "}
          <code className="bg-muted px-1 py-0.5 rounded">
            {mcpHelp.location}
          </code>
        </div>
      </PopoverContent>
    </Popover>
  );
});
