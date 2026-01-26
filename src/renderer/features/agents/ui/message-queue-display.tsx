"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import type { QueuedMessage } from "../atoms";

interface MessageQueueDisplayProps {
  queue: QueuedMessage[];
  onRemove: (messageId: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export const MessageQueueDisplay = memo(function MessageQueueDisplay({
  queue,
  onRemove,
  onClearAll,
  className,
}: MessageQueueDisplayProps) {
  if (queue.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-t-xl border border-b-0 border-border bg-muted/30 overflow-hidden",
        className,
      )}
    >
      <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">Queued Messages</span>
          <span className="text-muted-foreground/60">({queue.length})</span>
        </div>
        {onClearAll && queue.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearAll}
          >
            Clear all
          </Button>
        )}
      </div>
      <div className="max-h-[150px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {queue.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="border-b border-border last:border-b-0"
            >
              <div className="flex items-start gap-2 px-3 py-2 group hover:bg-muted/50">
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5 tabular-nums">
                  {index + 1}.
                </span>
                <p className="flex-1 text-sm text-foreground line-clamp-2 break-words">
                  {message.text || "(Attachment)"}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemove(message.id)}
                  aria-label="Remove from queue"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});
