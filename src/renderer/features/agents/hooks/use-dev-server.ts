"use client";

import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { trpc } from "../../../lib/trpc";
import {
  chatViewModeAtomFamily,
  devServerPortsAtomFamily,
  devServerStateAtomFamily,
  localPreviewUrlAtomFamily,
} from "../atoms";

interface UseDevServerParams {
  chatId: string;
  workspaceId: string;
  cwd: string;
  runCommand: string | null | undefined;
}

export function useDevServer({
  chatId,
  workspaceId,
  cwd,
  runCommand,
}: UseDevServerParams) {
  const [devServerState, setDevServerState] = useAtom(
    devServerStateAtomFamily(chatId),
  );
  const [detectedPorts, setDetectedPorts] = useAtom(
    devServerPortsAtomFamily(chatId),
  );
  const setViewMode = useSetAtom(chatViewModeAtomFamily(chatId));
  const setLocalPreviewUrl = useSetAtom(localPreviewUrlAtomFamily(chatId));

  const createTerminal = trpc.terminal.createOrAttach.useMutation();
  const killTerminal = trpc.terminal.kill.useMutation();

  const devServerPaneId = `devserver:${chatId}`;
  const isActive =
    devServerState?.status === "starting" ||
    devServerState?.status === "running";

  // Subscribe to port changes while dev server is active (starting or running)
  trpc.ports.onPortChange.useSubscription(
    { workspaceId },
    {
      enabled: isActive,
      onData: (event) => {
        if (event.port.paneId !== devServerPaneId) return;

        if (event.type === "add") {
          const port = event.port.port;

          setDetectedPorts((prev) => {
            if (prev.includes(port)) return prev;
            return [...prev, port].sort((a, b) => a - b);
          });

          // First port detected - set as preview URL, switch to running, open split
          if (devServerState?.status === "starting") {
            setDevServerState({
              paneId: devServerPaneId,
              port,
              status: "running",
            });
            setLocalPreviewUrl(`http://localhost:${port}`);
            setViewMode("split");
          }
        } else if (event.type === "remove") {
          const port = event.port.port;
          setDetectedPorts((prev) => prev.filter((p) => p !== port));
        }
      },
    },
  );

  // Subscribe to terminal exit to detect when dev server stops
  trpc.terminal.stream.useSubscription(devServerPaneId, {
    enabled: isActive,
    onData: (event) => {
      if (event.type === "exit") {
        setDevServerState(null);
        setLocalPreviewUrl(null);
        setDetectedPorts([]);
      }
    },
  });

  const startDevServer = useCallback(async () => {
    if (!runCommand || !cwd) return;

    setDetectedPorts([]);
    setDevServerState({
      paneId: devServerPaneId,
      port: null,
      status: "starting",
    });

    try {
      await createTerminal.mutateAsync({
        paneId: devServerPaneId,
        workspaceId,
        cwd,
        initialCommands: [runCommand],
      });
    } catch (err) {
      console.error("[useDevServer] Failed to start dev server:", err);
      setDevServerState(null);
    }
  }, [
    chatId,
    runCommand,
    cwd,
    workspaceId,
    createTerminal,
    setDevServerState,
    setDetectedPorts,
    devServerPaneId,
  ]);

  const stopDevServer = useCallback(async () => {
    if (!devServerState?.paneId) return;

    try {
      await killTerminal.mutateAsync({ paneId: devServerState.paneId });
    } catch (err) {
      console.error("[useDevServer] Failed to stop dev server:", err);
    }
    setDevServerState(null);
    setLocalPreviewUrl(null);
    setDetectedPorts([]);
  }, [
    devServerState,
    killTerminal,
    setDevServerState,
    setLocalPreviewUrl,
    setDetectedPorts,
  ]);

  return {
    devServerState,
    detectedPorts,
    startDevServer,
    stopDevServer,
    isRunning: devServerState?.status === "running",
    isStarting: devServerState?.status === "starting",
    port: devServerState?.port ?? null,
  };
}
