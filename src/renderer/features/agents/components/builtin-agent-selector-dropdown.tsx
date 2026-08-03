import { BUILTIN_AGENTS, type BuiltinAgentId } from "@shared/builtin-agents";
import { Bot, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CheckIcon, IconChevronDown } from "../../../components/ui/icons";

type BuiltinAgentSelectorDropdownProps = {
  readonly agentId: BuiltinAgentId | null;
  readonly onAgentChange: (agentId: BuiltinAgentId | null) => void;
  readonly disabled?: boolean;
};

export function BuiltinAgentSelectorDropdown({
  agentId,
  onAgentChange,
  disabled = false,
}: BuiltinAgentSelectorDropdownProps) {
  const currentAgent = BUILTIN_AGENTS.find((agent) => agent.id === agentId);
  const triggerLabel = currentAgent?.name ?? "默认智能体";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`选择内置智能体，当前为${triggerLabel}`}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-[background-color,color] duration-150 ease-out hover:bg-muted/50 hover:text-foreground outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {agentId ? (
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Bot className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="max-w-32 truncate">{triggerLabel}</span>
        <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[260px] max-w-[90vw]"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem
          onClick={() => onAgentChange(null)}
          className="items-start justify-between gap-3"
        >
          <div className="flex min-w-0 items-start gap-2">
            <Bot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="font-medium">默认智能体</div>
              <div className="text-xs text-muted-foreground">
                使用当前服务商的默认指令与行为
              </div>
            </div>
          </div>
          {agentId === null && (
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
        </DropdownMenuItem>
        {BUILTIN_AGENTS.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => onAgentChange(agent.id)}
            className="items-start justify-between gap-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium">{agent.name}</div>
                <div className="text-xs text-muted-foreground">
                  {agent.description}
                </div>
              </div>
            </div>
            {agentId === agent.id && (
              <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
