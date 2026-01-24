"use client";

import { useAtom, useAtomValue } from "jotai";
import { ChevronDown, Globe, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { trpc } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import {
  devServerPortsAtomFamily,
  devServerStateAtomFamily,
  localPreviewUrlAtomFamily,
} from "../atoms";

// Strip ANSI escape codes for readable log output
function stripAnsi(str: string): string {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    "",
  );
}

interface LocalPreviewProps {
  chatId: string;
  onClose?: () => void;
}

export function LocalPreview({ chatId, onClose }: LocalPreviewProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useAtom(
    localPreviewUrlAtomFamily(chatId),
  );
  const detectedPorts = useAtomValue(devServerPortsAtomFamily(chatId));
  const devServerState = useAtomValue(devServerStateAtomFamily(chatId));
  const [isLoading, setIsLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(localPreviewUrl || "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPortMenuOpen, setIsPortMenuOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const portMenuRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isStarting = devServerState?.status === "starting";
  const devServerPaneId = `devserver:${chatId}`;

  // Derive current port from the preview URL
  const currentPort = localPreviewUrl
    ? Number.parseInt(new URL(localPreviewUrl).port, 10)
    : null;

  // Subscribe to terminal stream to capture startup logs
  trpc.terminal.stream.useSubscription(devServerPaneId, {
    enabled: isStarting,
    onData: (event) => {
      if (event.type === "data") {
        const cleaned = stripAnsi(event.data);
        // Split by newlines and filter empty lines for cleaner output
        const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          setLogLines((prev) => [...prev, ...lines].slice(-200));
        }
      }
    },
  });

  // Clear logs when server starts fresh
  useEffect(() => {
    if (isStarting) {
      setLogLines([]);
    }
  }, [isStarting]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  // Update current URL when the source URL changes
  useEffect(() => {
    if (localPreviewUrl) {
      setCurrentUrl(localPreviewUrl);
    }
  }, [localPreviewUrl]);

  // Close port menu on outside click
  useEffect(() => {
    if (!isPortMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        portMenuRef.current &&
        !portMenuRef.current.contains(e.target as Node)
      ) {
        setIsPortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isPortMenuOpen]);

  // Set up webview event listeners
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDidStartLoading = () => {
      setIsLoading(true);
    };

    const handleDidStopLoading = () => {
      setIsLoading(false);
      setIsRefreshing(false);
    };

    const handleDidNavigate = (event: Electron.DidNavigateEvent) => {
      setCurrentUrl(event.url);
    };

    const handleDidNavigateInPage = (
      event: Electron.DidNavigateInPageEvent,
    ) => {
      setCurrentUrl(event.url);
    };

    const handleDidFailLoad = () => {
      setIsLoading(false);
      setIsRefreshing(false);
    };

    webview.addEventListener("did-start-loading", handleDidStartLoading);
    webview.addEventListener("did-stop-loading", handleDidStopLoading);
    webview.addEventListener("did-navigate", handleDidNavigate);
    webview.addEventListener("did-navigate-in-page", handleDidNavigateInPage);
    webview.addEventListener("did-fail-load", handleDidFailLoad);

    return () => {
      webview.removeEventListener("did-start-loading", handleDidStartLoading);
      webview.removeEventListener("did-stop-loading", handleDidStopLoading);
      webview.removeEventListener("did-navigate", handleDidNavigate);
      webview.removeEventListener(
        "did-navigate-in-page",
        handleDidNavigateInPage,
      );
      webview.removeEventListener("did-fail-load", handleDidFailLoad);
    };
  }, [localPreviewUrl]);

  const handleReload = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const webview = webviewRef.current;
    if (webview) {
      webview.reload();
    }
  }, [isRefreshing]);

  const handleSelectPort = useCallback(
    (port: number) => {
      setLocalPreviewUrl(`http://localhost:${port}`);
      setIsPortMenuOpen(false);
    },
    [setLocalPreviewUrl],
  );

  // Show waiting state when no URL yet
  if (!localPreviewUrl) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        <Globe className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          {isStarting ? "Starting dev server..." : "Waiting for dev server..."}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          The preview will appear when a port is detected
        </p>
        {/* Compact log block */}
        {isStarting && logLines.length > 0 && (
          <div className="mt-4 w-full max-w-md max-h-40 overflow-auto rounded-md border text-left">
            <div className="p-2 font-mono text-[11px] text-muted-foreground/80 leading-4">
              {logLines.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
        {isStarting && (
          <div className="mt-3 w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-tl-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-10 bg-tl-background shrink-0 border-b border-border/50">
        <Button
          variant="ghost"
          onClick={handleReload}
          disabled={isRefreshing}
          className="h-7 w-7 p-0 hover:bg-muted rounded-md shrink-0"
        >
          <RotateCw
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground",
              isRefreshing && "animate-spin",
            )}
          />
        </Button>

        {/* Port chooser - shown when multiple ports detected */}
        {detectedPorts.length > 1 && (
          <div className="relative flex items-center gap-1" ref={portMenuRef}>
            {isLoading && (
              <div className="w-3 h-3 border-[1.5px] border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin shrink-0" />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs font-mono text-muted-foreground hover:text-foreground"
              onClick={() => setIsPortMenuOpen(!isPortMenuOpen)}
            >
              :{currentPort}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {isPortMenuOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md py-1 min-w-[100px]">
                {detectedPorts.map((port) => (
                  <button
                    key={port}
                    type="button"
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-muted transition-colors",
                      port === currentPort
                        ? "text-foreground bg-muted/50"
                        : "text-muted-foreground",
                    )}
                    onClick={() => handleSelectPort(port)}
                  >
                    localhost:{port}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded text-xs text-muted-foreground font-mono truncate">
            {isLoading && (
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
            )}
            {!isLoading && (
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            )}
            <span className="truncate">{currentUrl}</span>
          </div>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-muted rounded-md shrink-0"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Webview */}
      <div className="flex-1 relative overflow-hidden">
        <webview
          ref={webviewRef as any}
          src={localPreviewUrl}
          className="w-full h-full"
          // @ts-expect-error webview attributes not in React types
          allowpopups="true"
          style={{ display: "flex", flex: 1 }}
        />
      </div>
    </div>
  );
}
