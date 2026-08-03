import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { trpc } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import { AgentIcon } from "../../ui/icons";

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

interface FileAgent {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  source: "user" | "project";
  path: string;
}

export function AgentsCustomAgentsTab() {
  const isNarrowScreen = useIsNarrowScreen();
  const [expandedAgentName, setExpandedAgentName] = useState<string | null>(
    null,
  );

  const { data: agents = [], isLoading } = trpc.agents.list.useQuery(undefined);

  const openInFinderMutation = trpc.external.openInFinder.useMutation();

  const userAgents = agents.filter((a) => a.source === "user");
  const projectAgents = agents.filter((a) => a.source === "project");

  const handleExpandAgent = (agentName: string) => {
    setExpandedAgentName(expandedAgentName === agentName ? null : agentName);
  };

  const handleOpenInFinder = (path: string) => {
    openInFinderMutation.mutate(path);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
      {/* Header - hidden on narrow screens */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">
            自定义智能体
          </h3>
          <a
            href="https://code.claude.com/docs/en/sub-agents"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            文档
          </a>
        </div>
      )}

      {/* Agents List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-background rounded-lg border border-border p-4 text-sm text-muted-foreground text-center">
            正在加载智能体…
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-background rounded-lg border border-border p-6 text-center">
            <AgentIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              未找到自定义智能体
            </p>
            <p className="text-xs text-muted-foreground">
              将 .md 文件添加到{" "}
              <code className="px-1 py-0.5 bg-muted rounded">
                ~/.claude/agents/
              </code>
            </p>
          </div>
        ) : (
          <>
            {/* User Agents */}
            {userAgents.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  ~/.claude/agents/
                </div>
                <div className="bg-background rounded-lg border border-border overflow-hidden">
                  <div className="divide-y divide-border">
                    {userAgents.map((agent) => (
                      <AgentRow
                        key={agent.name}
                        agent={agent}
                        isExpanded={expandedAgentName === agent.name}
                        onToggle={() => handleExpandAgent(agent.name)}
                        onOpenInFinder={() => handleOpenInFinder(agent.path)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Project Agents */}
            {projectAgents.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  .claude/agents/
                </div>
                <div className="bg-background rounded-lg border border-border overflow-hidden">
                  <div className="divide-y divide-border">
                    {projectAgents.map((agent) => (
                      <AgentRow
                        key={agent.name}
                        agent={agent}
                        isExpanded={expandedAgentName === agent.name}
                        onToggle={() => handleExpandAgent(agent.name)}
                        onOpenInFinder={() => handleOpenInFinder(agent.path)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Section */}
      <div className="pt-4 border-t border-border space-y-3">
        <div>
          <h4 className="text-xs font-medium text-foreground mb-1.5">
            自定义智能体的工作方式
          </h4>
          <p className="text-xs text-muted-foreground">
            智能体是 Claude 可通过 Task
            工具调用的专用子智能体，拥有独立的系统提示词、工具和模型设置。
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-foreground mb-1.5">
            使用智能体
          </h4>
          <p className="text-xs text-muted-foreground">
            你可以直接要求 Claude 使用某个智能体（例如“使用 code-reviewer
            智能体”），Claude 也会在合适时自动调用它们。
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-foreground mb-1.5">
            文件格式
          </h4>
          <p className="text-xs text-muted-foreground">
            智能体是带有 YAML 前置元数据的 Markdown 文件，其中包含{" "}
            <code className="px-1 py-0.5 bg-muted rounded">name</code>、
            <code className="px-1 py-0.5 bg-muted rounded">description</code>、
            <code className="px-1 py-0.5 bg-muted rounded">tools</code> 和{" "}
            <code className="px-1 py-0.5 bg-muted rounded">model</code>
            。正文是系统提示词。
          </p>
        </div>
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  isExpanded,
  onToggle,
  onOpenInFinder,
}: {
  agent: FileAgent;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenInFinder: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            isExpanded && "rotate-90",
          )}
        />
        <div className="flex flex-col space-y-0.5 min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground truncate">
            {agent.name}
          </span>
          {agent.description && (
            <span className="text-xs text-muted-foreground truncate">
              {agent.description}
            </span>
          )}
        </div>
        {agent.model && agent.model !== "inherit" && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground shrink-0">
            {agent.model}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border bg-muted/20">
              <div className="pt-3 space-y-3">
                {/* Path - clickable to open in Finder */}
                <div>
                  <span className="text-xs font-medium text-foreground">
                    路径
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInFinder();
                    }}
                    className="block text-xs text-muted-foreground font-mono mt-0.5 break-all text-left hover:text-foreground hover:underline transition-colors cursor-pointer"
                  >
                    {agent.path}
                  </button>
                </div>

                {/* Tools */}
                {agent.tools && agent.tools.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      允许的工具
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.tools.map((tool) => (
                        <span
                          key={tool}
                          className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disallowed Tools */}
                {agent.disallowedTools && agent.disallowedTools.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      禁止的工具
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.disallowedTools.map((tool) => (
                        <span
                          key={tool}
                          className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
