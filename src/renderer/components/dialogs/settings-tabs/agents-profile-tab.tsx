import { useEffect, useState } from "react";

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

export function AgentsProfileTab() {
  const isNarrowScreen = useIsNarrowScreen();

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        {!isNarrowScreen && (
          <div className="flex items-center justify-between pb-3 mb-4">
            <h3 className="text-sm font-medium text-foreground">Account</h3>
          </div>
        )}
        <div className="bg-background rounded-lg border border-border overflow-hidden">
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              Authentication is handled by Claude Code CLI. Run{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
                claude login
              </code>{" "}
              in your terminal to authenticate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
