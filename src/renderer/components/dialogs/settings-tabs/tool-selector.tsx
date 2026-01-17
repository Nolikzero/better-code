import { cn } from "../../../lib/utils"

export const AVAILABLE_TOOLS = [
  // File Operations
  { id: "Read", name: "Read File", category: "file", description: "Read file contents" },
  { id: "Write", name: "Write File", category: "file", description: "Create or overwrite files" },
  { id: "Edit", name: "Edit File", category: "file", description: "Make precise edits" },
  { id: "Glob", name: "Glob Pattern", category: "file", description: "Find files by pattern" },
  { id: "Grep", name: "Search Content", category: "file", description: "Search in file contents" },
  { id: "NotebookEdit", name: "Notebook Edit", category: "file", description: "Edit Jupyter notebooks" },

  // System
  { id: "Bash", name: "Bash Commands", category: "system", description: "Execute shell commands" },
  { id: "Task", name: "Launch Subagent", category: "system", description: "Launch specialized agents" },

  // Web
  { id: "WebSearch", name: "Web Search", category: "web", description: "Search the internet" },
  { id: "WebFetch", name: "Fetch URL", category: "web", description: "Fetch webpage content" },

  // Planning & Interaction
  { id: "TodoWrite", name: "Todo List", category: "planning", description: "Manage task list" },
  { id: "AskUserQuestion", name: "Ask User", category: "planning", description: "Ask clarifying questions" },
]

const CATEGORIES = [
  { id: "file", name: "File Operations" },
  { id: "system", name: "System" },
  { id: "web", name: "Web" },
  { id: "planning", name: "Planning" },
]

interface ToolSelectorProps {
  selectedTools: string[]
  onChange: (tools: string[]) => void
  mode: "allowlist" | "denylist"
}

export function ToolSelector({ selectedTools, onChange, mode }: ToolSelectorProps) {
  const handleToggle = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onChange(selectedTools.filter((t) => t !== toolId))
    } else {
      onChange([...selectedTools, toolId])
    }
  }

  const handleSelectAll = () => {
    onChange(AVAILABLE_TOOLS.map((t) => t.id))
  }

  const handleSelectNone = () => {
    onChange([])
  }

  return (
    <div className="space-y-3">
      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Select all
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          onClick={handleSelectNone}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {selectedTools.length} selected
        </span>
      </div>

      {/* Tools by category */}
      <div className="space-y-4 p-3 rounded-lg border border-border bg-muted/20">
        {CATEGORIES.map((category) => {
          const categoryTools = AVAILABLE_TOOLS.filter((t) => t.category === category.id)
          if (categoryTools.length === 0) return null

          return (
            <div key={category.id} className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {category.name}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {categoryTools.map((tool) => {
                  const isSelected = selectedTools.includes(tool.id)
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleToggle(tool.id)}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-md border text-left transition-colors",
                        isSelected
                          ? mode === "allowlist"
                            ? "border-green-500/30 bg-green-500/10"
                            : "border-red-500/30 bg-red-500/10"
                          : "border-transparent bg-background hover:bg-foreground/5"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? mode === "allowlist"
                              ? "border-green-500 bg-green-500"
                              : "border-red-500 bg-red-500"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && (
                          <svg
                            className="h-2.5 w-2.5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {tool.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {tool.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground">
        {mode === "allowlist"
          ? "Agent will ONLY have access to selected tools"
          : "Agent will have access to ALL tools EXCEPT selected ones"}
      </p>
    </div>
  )
}
