"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { cn } from "../../../lib/utils";
import { RenderFileMentions } from "../mentions/render-file-mentions";
import { AgentImageItem } from "./agent-image-item";

interface AgentUserMessageBubbleProps {
  messageId: string;
  textContent: string;
  imageParts?: Array<{
    data?: {
      filename?: string;
      url?: string;
    };
  }>;
}

export const AgentUserMessageBubble = memo(function AgentUserMessageBubble({
  messageId,
  textContent,
  imageParts = [],
}: AgentUserMessageBubbleProps) {
  const [showGradient, setShowGradient] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if content overflows to show gradient
  const checkOverflow = useCallback(() => {
    if (contentRef.current) {
      const element = contentRef.current;
      setShowGradient(element.scrollHeight > element.clientHeight);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    // Recheck on resize
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [checkOverflow, textContent]);

  return (
    <>
      <div
        className="flex justify-start drop-shadow-[0_10px_20px_hsl(var(--background))]"
        data-user-bubble
      >
        <div className="space-y-2 w-full">
          {/* Show attached images from stored message */}
          {imageParts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                // Build allImages array for gallery navigation
                const allImages = imageParts
                  .filter((img) => img.data?.url)
                  .map((img, idx) => ({
                    id: `${messageId}-img-${idx}`,
                    filename: img.data?.filename || "image",
                    url: img.data?.url || "",
                  }));

                return imageParts.map((img, idx) => (
                  <AgentImageItem
                    key={`${messageId}-img-${idx}`}
                    id={`${messageId}-img-${idx}`}
                    filename={img.data?.filename || "image"}
                    url={img.data?.url || ""}
                    allImages={allImages}
                    imageIndex={idx}
                  />
                ));
              })()}
            </div>
          )}
          {/* Text bubble with overflow detection */}
          {textContent && (
            <div
              ref={contentRef}
              onClick={() => showGradient && setIsExpanded(true)}
              className={cn(
                "relative max-h-[40px] overflow-hidden border px-3 py-2 rounded-xs whitespace-pre-wrap text-sm transition-[filter]",
                showGradient && "cursor-pointer hover:brightness-110",
              )}
            >
              <RenderFileMentions text={textContent} />
              {showGradient && (
                <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t from-[hsl(var(--input-background))] to-transparent rounded-b-sm" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full message dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-muted-foreground">
              Full message
            </DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm">
            <RenderFileMentions text={textContent} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
