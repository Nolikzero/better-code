"use client";

import { Check, ChevronDown, ChevronUp, Terminal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useRef, useState } from "react";
import { trpc } from "../../../lib/trpc";

// Animated dots component that cycles through ., .., ...
function AnimatedDots() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block w-[1em] text-left">
      {".".repeat(dotCount)}
    </span>
  );
}

interface WorktreeInitProgressProps {
  chatId: string;
  onComplete?: () => void;
}

export const WorktreeInitProgress = memo(function WorktreeInitProgress({
  chatId,
  onComplete,
}: WorktreeInitProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [output, setOutput] = useState("");
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);
  const completedRef = useRef(false);

  // Get initial status
  const { data: status } = trpc.worktreeInit.getStatus.useQuery(
    { chatId },
    {
      refetchInterval: (query) => {
        // Stop polling when completed or error
        const data = query.state.data;
        if (data?.status === "completed" || data?.status === "error") {
          return false;
        }
        return 1000; // Poll every second while running
      },
    },
  );

  // Update output and call onComplete when status changes
  useEffect(() => {
    if (status?.output && status.output !== output) {
      setOutput(status.output);
    }
    if (
      status &&
      (status.status === "completed" || status.status === "error") &&
      !completedRef.current
    ) {
      completedRef.current = true;
      onComplete?.();

      // Show success state for 3 seconds before hiding
      if (status.status === "completed") {
        setShowSuccess(true);
        const timer = setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [status, output, onComplete]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current && isExpanded) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, isExpanded]);

  // Clear status mutation
  const clearStatus = trpc.worktreeInit.clearStatus.useMutation();

  const handleDismiss = () => {
    clearStatus.mutate({ chatId });
    setIsDismissed(true);
  };

  // Don't render if no status, dismissed, or completed successfully (after 3s delay)
  if (!status || isDismissed) {
    return null;
  }

  // Don't show if completed successfully and the 3-second delay has passed
  if (status.status === "completed" && !showSuccess) {
    return null;
  }

  const isRunning = status.status === "running";
  const isError = status.status === "error";

  return (
    <div className="max-w-2xl 2xl:max-w-4xl mx-auto px-4 rounded-lg border border-border bg-muted/30 overflow-hidden mb-4">
      {/* Expanded output */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          >
            <pre
              ref={outputRef}
              className="max-h-[200px] overflow-auto p-3 text-xs font-mono bg-background/50 border-b border-border whitespace-pre-wrap"
            >
              {output || "Initializing..."}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 h-10 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          {isRunning ? (
            <Terminal className="w-4 h-4 text-blue-500 animate-pulse" />
          ) : isError ? (
            <X className="w-4 h-4 text-red-500" />
          ) : (
            <Check className="w-4 h-4 text-green-500" />
          )}

          <span className="text-muted-foreground">
            {isRunning ? (
              <>
                Running init command
                <AnimatedDots />
              </>
            ) : isError ? (
              `Init command failed (exit code ${status.exitCode})`
            ) : (
              "Init command completed"
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isError && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              Dismiss
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>
    </div>
  );
});
