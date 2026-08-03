"use client";

import { useAtomValue } from "jotai";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useProviders } from "../../../features/agents/hooks/use-providers";
import { resolveProviderDisplayName } from "../../../features/agents/lib/provider-display";
import { defaultProviderIdAtom, sessionInfoAtom } from "../../../lib/atoms";
import { getProviderMcpHelp } from "../../../lib/provider-mcp";
import { cn } from "../../../lib/utils";
import { OriginalMCPIcon } from "../../ui/icons";

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  return isNarrow;
}

// Status indicator dot
function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        status === "connected" && "bg-foreground",
        status !== "connected" && "bg-muted-foreground/50",
        status === "pending" && "animate-pulse",
      )}
    />
  );
}

// Get status text
function getStatusText(status: string): string {
  switch (status) {
    case "connected":
      return "已连接";
    case "failed":
      return "失败";
    case "needs-auth":
      return "需要认证";
    case "pending":
      return "正在连接…";
    default:
      return "未知状态";
  }
}

interface ServerRowProps {
  server: {
    name: string;
    status: string;
    serverInfo?: { name: string; version: string };
    error?: string;
  };
  tools: string[];
  isExpanded: boolean;
  onToggle: () => void;
}

function ServerRow({ server, tools, isExpanded, onToggle }: ServerRowProps) {
  const hasTools = tools.length > 0;

  return (
    <div>
      <button
        onClick={hasTools ? onToggle : undefined}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left transition-colors",
          hasTools && "hover:bg-muted/50 cursor-pointer",
          !hasTools && "cursor-default",
        )}
      >
        {/* Expand chevron */}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
            isExpanded && "rotate-90",
            !hasTools && "opacity-0",
          )}
        />

        {/* Status dot */}
        <StatusDot status={server.status} />

        {/* Server info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {server.name}
            </span>
            {server.serverInfo?.version && (
              <span className="text-xs text-muted-foreground">
                v{server.serverInfo.version}
              </span>
            )}
          </div>
          {server.error && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {server.error}
            </p>
          )}
        </div>

        {/* Status / tool count */}
        <span className="text-xs text-muted-foreground shrink-0">
          {server.status === "connected" && hasTools
            ? `${tools.length} 个工具`
            : getStatusText(server.status)}
        </span>
      </button>

      {/* Expanded tools list */}
      <AnimatePresence>
        {isExpanded && hasTools && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pl-10 pr-3 pb-3 space-y-1">
              {tools.map((tool) => (
                <div
                  key={tool}
                  className="text-xs text-muted-foreground font-mono py-0.5"
                >
                  {tool}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AgentsMcpTab() {
  const isNarrowScreen = useIsNarrowScreen();
  const [expandedServer, setExpandedServer] = useState<string | null>(null);

  const sessionInfo = useAtomValue(sessionInfoAtom);
  const defaultProvider = useAtomValue(defaultProviderIdAtom);
  const { providers } = useProviders();

  // Check if sessionInfo is from a different provider
  const sessionProvider = sessionInfo?.providerId;
  const providerMismatch =
    sessionProvider && sessionProvider !== defaultProvider;

  // Only show MCP servers if they're from the current provider
  const mcpServers = providerMismatch ? [] : sessionInfo?.mcpServers || [];
  const tools = providerMismatch ? [] : sessionInfo?.tools || [];

  const mcpHelp = getProviderMcpHelp(defaultProvider);
  const providerName = resolveProviderDisplayName(defaultProvider, providers);

  // Group tools by server
  const toolsByServer = mcpServers.reduce(
    (acc, server) => {
      const serverTools = tools
        .filter((tool) => tool.startsWith(`mcp__${server.name}__`))
        .map((tool) => tool.split("__").slice(2).join("__"));
      acc[server.name] = serverTools;
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const handleToggleServer = (serverName: string) => {
    setExpandedServer(expandedServer === serverName ? null : serverName);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
      {/* Header */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">MCP 服务器</h3>
          {mcpHelp.docsUrl ? (
            <a
              href={mcpHelp.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              查看配置文档
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">
              {mcpHelp.description}
            </span>
          )}
        </div>
      )}

      {/* Servers List */}
      <div className="space-y-4">
        {mcpServers.length === 0 ? (
          <div className="bg-background rounded-lg border border-border p-6 text-center">
            <OriginalMCPIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            {providerMismatch ? (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  启动新的 {providerName} 对话后，MCP 服务器会显示在这里
                </p>
                <p className="text-xs text-muted-foreground">
                  在以下位置配置服务器：{" "}
                  <code className="px-1 py-0.5 bg-muted rounded">
                    {mcpHelp.location}
                  </code>
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  未配置 MCP 服务器
                </p>
                <p className="text-xs text-muted-foreground">
                  请通过以下方式添加服务器：{" "}
                  <code className="px-1 py-0.5 bg-muted rounded">
                    {mcpHelp.location}
                  </code>
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {mcpServers.map((server) => (
                <ServerRow
                  key={server.name}
                  server={server}
                  tools={toolsByServer[server.name] || []}
                  isExpanded={expandedServer === server.name}
                  onToggle={() => handleToggleServer(server.name)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="pt-4 border-t border-border space-y-3">
        <div>
          <h4 className="text-xs font-medium text-foreground mb-1.5">
            如何使用 MCP 工具
          </h4>
          <p className="text-xs text-muted-foreground">
            在对话中通过{" "}
            <code className="px-1 py-0.5 bg-muted rounded">@tool-name</code>{" "}
            提及工具，或直接要求智能体使用它。
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-foreground mb-1.5">
            配置服务器
          </h4>
          <p className="text-xs text-muted-foreground">{mcpHelp.description}</p>
        </div>
      </div>
    </div>
  );
}
