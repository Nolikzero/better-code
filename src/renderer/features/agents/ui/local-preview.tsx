"use client";

import { useAtom, useAtomValue } from "jotai";
import {
  ChevronDown,
  Globe,
  Monitor,
  RotateCw,
  Smartphone,
  Tablet,
  Terminal,
  X,
} from "lucide-react";
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

const VIEWPORT_PRESETS = {
  mobile: { label: "Mobile", width: 393, height: 852, Icon: Smartphone },
  tablet: { label: "Tablet", width: 820, height: 1180, Icon: Tablet },
  desktop: { label: "Desktop", width: null, height: null, Icon: Monitor },
} as const;

type ViewportPreset = keyof typeof VIEWPORT_PRESETS;

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
  const [viewportPreset, setViewportPreset] =
    useState<ViewportPreset>("desktop");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const portMenuRef = useRef<HTMLDivElement>(null);
  const logsMenuRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isStarting = devServerState?.status === "starting";
  const devServerPaneId = `devserver:${chatId}`;
  const activeViewport = VIEWPORT_PRESETS[viewportPreset];

  // Track if we've loaded initial logs for this session
  const hasLoadedInitialLogs = useRef(false);

  // Fetch existing output buffer when component mounts (to get logs from before we subscribed)
  const { data: outputData } = trpc.terminal.getOutput.useQuery(
    { paneId: devServerPaneId },
    { enabled: devServerState?.status === "running" },
  );

  // Populate logs from buffer on initial load (only once per session)
  useEffect(() => {
    if (
      outputData?.output &&
      outputData.output.length > 0 &&
      !hasLoadedInitialLogs.current
    ) {
      const allOutput = outputData.output.join("");
      const cleaned = stripAnsi(allOutput);
      const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        setLogLines(lines.slice(-200));
        // Mark as loaded only after successfully setting logs
        hasLoadedInitialLogs.current = true;
      }
    }
  }, [outputData]);

  // Derive current port from the preview URL
  const currentPort = localPreviewUrl
    ? Number.parseInt(new URL(localPreviewUrl).port, 10)
    : null;

  // Subscribe to terminal stream to capture server logs (startup and runtime)
  const isServerActive = isStarting || devServerState?.status === "running";
  trpc.terminal.stream.useSubscription(devServerPaneId, {
    enabled: isServerActive,
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
      hasLoadedInitialLogs.current = false;
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
      setIsLoading(true); // Start loading when URL changes
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

  // Close logs menu on outside click
  useEffect(() => {
    if (!isLogsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        logsMenuRef.current &&
        !logsMenuRef.current.contains(e.target as Node)
      ) {
        setIsLogsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isLogsOpen]);

  // Set up iframe event listeners
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadError(null);
      // Try to get current URL from iframe (works for same-origin localhost)
      try {
        const iframeUrl = iframe.contentWindow?.location.href;
        if (iframeUrl && iframeUrl !== "about:blank") {
          setCurrentUrl(iframeUrl);
        }
      } catch {
        // Cross-origin restriction - keep the original URL
      }
    };

    const handleError = () => {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadError("Failed to load preview");
    };

    iframe.addEventListener("load", handleLoad);
    iframe.addEventListener("error", handleError);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      iframe.removeEventListener("error", handleError);
    };
  }, [localPreviewUrl]);

  const handleReload = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsLoading(true);
    setLoadError(null);
    const iframe = iframeRef.current;
    if (iframe) {
      // Reload by resetting the src attribute
      const currentSrc = iframe.src;
      iframe.src = "";
      iframe.src = currentSrc;
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
      <div className="flex flex-col h-full bg-tl-background">
        <div className="flex items-center gap-2 px-3 h-10 bg-tl-background shrink-0 border-b border-border/50">
          <div className="flex-1 min-w-0 text-xs text-muted-foreground">
            Local preview
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Globe className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {isStarting
              ? "Starting dev server..."
              : "Waiting for dev server..."}
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
              <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-md py-1 min-w-[100px]">
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

        <div className="flex items-center rounded-md bg-muted/40 p-0.5 shrink-0">
          {(Object.keys(VIEWPORT_PRESETS) as ViewportPreset[]).map((preset) => {
            const { label, Icon } = VIEWPORT_PRESETS[preset];
            const isActive = preset === viewportPreset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setViewportPreset(preset)}
                aria-pressed={isActive}
                title={label}
                className={cn(
                  "h-6 w-6 rounded-md flex items-center justify-center transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {/* Server logs dropdown */}
        <div className="relative" ref={logsMenuRef}>
          <Button
            variant="ghost"
            className={cn(
              "h-7 w-7 p-0 hover:bg-muted rounded-md shrink-0",
              logLines.length > 0 && "text-foreground",
            )}
            onClick={() => setIsLogsOpen(!isLogsOpen)}
            title="Server logs"
          >
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          {isLogsOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 w-80 max-h-64 overflow-auto bg-background border border-border rounded-md shadow-lg">
              {logLines.length > 0 ? (
                <div className="p-2 font-mono text-[11px] text-muted-foreground leading-4">
                  {logLines.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              ) : (
                <p className="p-3 text-xs text-muted-foreground text-center">
                  No logs yet
                </p>
              )}
            </div>
          )}
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

      {/* Iframe */}
      <div
        className={cn(
          "flex-1 relative overflow-hidden",
          viewportPreset !== "desktop" &&
            "flex items-center justify-center p-3",
        )}
      >
        <div
          className={cn(
            "relative bg-background",
            viewportPreset === "desktop" ? "w-full h-full" : "w-full h-full",
            viewportPreset !== "desktop" &&
              "rounded-xl border border-border/50 shadow-sm overflow-hidden",
          )}
          style={
            viewportPreset === "desktop"
              ? undefined
              : {
                  width: `${activeViewport.width}px`,
                  height: `${activeViewport.height}px`,
                  maxWidth: "100%",
                  maxHeight: "100%",
                }
          }
        >
          <iframe
            ref={iframeRef}
            src={localPreviewUrl}
            className="w-full h-full border-0"
            title="Local Preview"
            onLoad={() => {
              setIsLoading(false);
              setIsRefreshing(false);
            }}
          />
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/95">
              <div className="max-w-md text-center px-4">
                <Globe className="h-9 w-9 text-muted-foreground/60 mx-auto mb-3" />
                <div className="text-sm font-medium text-foreground">
                  Preview failed to load
                </div>
                <div className="text-xs text-muted-foreground mt-1 break-words">
                  {loadError}
                </div>
                <div className="text-xs text-muted-foreground/70 mt-2 break-words">
                  {currentUrl}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-7 px-2 text-xs"
                  onClick={handleReload}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
