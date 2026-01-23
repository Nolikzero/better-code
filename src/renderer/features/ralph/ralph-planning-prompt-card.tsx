"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { cn } from "../../lib/utils";

interface RalphPlanningPromptCardProps {
  originalMessage: string;
  fullPrompt: string;
  phase?: "planning" | "executing";
}

export const RalphPlanningPromptCard = memo(function RalphPlanningPromptCard({
  originalMessage,
  fullPrompt,
  phase = "planning",
}: RalphPlanningPromptCardProps) {
  const [showGradient, setShowGradient] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const checkOverflow = useCallback(() => {
    if (contentRef.current) {
      setShowGradient(
        contentRef.current.scrollHeight > contentRef.current.clientHeight,
      );
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [checkOverflow, originalMessage]);

  return (
    <>
      <div
        ref={contentRef}
        onClick={() => showGradient && setIsExpanded(true)}
        className={cn(
          "relative max-h-[40px] overflow-hidden bg-input-background border px-3 py-2 rounded-xs font-mono text-xs whitespace-pre-wrap transition-[filter]",
          showGradient && "cursor-pointer hover:brightness-110",
        )}
      >
        <span className="text-muted-foreground">
          [{phase === "executing" ? "ralph:exec" : "ralph:plan"}]
        </span>{" "}
        {originalMessage}
        {showGradient && (
          <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t from-[hsl(var(--input-background))] to-transparent rounded-b-sm" />
        )}
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-muted-foreground">
              {phase === "executing"
                ? "Ralph Execution Context"
                : "Ralph Planning Instructions"}
            </DialogTitle>
          </DialogHeader>
          <div className="font-mono text-xs whitespace-pre-wrap">
            {fullPrompt}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
