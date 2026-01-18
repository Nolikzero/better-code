"use client";

import { Check, Terminal } from "lucide-react";
import { IconSpinner } from "../../../../components/ui/icons";
import { trpc } from "../../../../lib/trpc";

export function AgentsClaudeCodeTab() {
  const {
    data: status,
    isLoading,
    error,
  } = trpc.providers.isReady.useQuery({ providerId: "claude" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconSpinner className="h-6 w-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  const isConnected = status?.ready;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-3 mb-4">
            <h3 className="text-sm font-medium text-foreground">Claude Code</h3>
          </div>

          <p className="text-sm text-muted-foreground">
            Claude Code uses CLI-based authentication. Use the terminal commands
            below to manage your authentication.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="p-4 space-y-6">
            {/* Connection Status */}
            {isConnected && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Ready to use
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Authentication managed via CLI
                  </p>
                </div>
              </div>
            )}

            {/* CLI Instructions */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Terminal className="w-4 h-4" />
                Terminal Commands
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    To sign in:
                  </p>
                  <code className="text-sm font-mono">claude login</code>
                </div>

                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    To sign out:
                  </p>
                  <code className="text-sm font-mono">claude logout</code>
                </div>

                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    To check status:
                  </p>
                  <code className="text-sm font-mono">claude --version</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
