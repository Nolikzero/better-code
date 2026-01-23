"use client";

import type { ExternalApp } from "@shared/types";
import { ExternalLink } from "lucide-react";
import { memo } from "react";
import { trpc } from "../lib/trpc";
import {
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "./ui/context-menu";
import { getEditorIcon } from "./ui/editor-icons";

interface OpenInContextMenuProps {
  path: string;
}

const CATEGORY_ORDER: ExternalApp["category"][] = [
  "file-manager",
  "editor",
  "ide",
  "terminal",
];

export const OpenInContextMenu = memo(function OpenInContextMenu({
  path,
}: OpenInContextMenuProps) {
  const { data } = trpc.external.getInstalledApps.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const openMutation = trpc.external.openInSpecificApp.useMutation();

  const apps = data?.apps ?? [];

  if (apps.length === 0) return null;

  const grouped: Record<string, ExternalApp[]> = {};
  for (const app of apps) {
    if (!grouped[app.category]) grouped[app.category] = [];
    grouped[app.category].push(app);
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <ExternalLink className="mr-2 h-4 w-4" />
        Open In...
      </ContextMenuSubTrigger>
      <ContextMenuPortal>
        <ContextMenuSubContent
          className="w-[180px] overflow-y-auto max-h-[min(var(--radix-context-menu-content-available-height,300px),300px)]"
          collisionPadding={8}
        >
          {CATEGORY_ORDER.map((category, catIdx) => {
            const categoryApps = grouped[category];
            if (!categoryApps || categoryApps.length === 0) return null;
            const showSeparator =
              catIdx > 0 &&
              CATEGORY_ORDER.slice(0, catIdx).some(
                (c) => grouped[c] && grouped[c].length > 0,
              );
            return (
              <div key={category}>
                {showSeparator && <ContextMenuSeparator />}
                {categoryApps.map((app) => (
                  <ContextMenuItem
                    key={app.id}
                    onClick={() => openMutation.mutate({ appId: app.id, path })}
                  >
                    {getEditorIcon(app.id, "mr-2 h-4 w-4 shrink-0")}
                    {app.name}
                  </ContextMenuItem>
                ))}
              </div>
            );
          })}
        </ContextMenuSubContent>
      </ContextMenuPortal>
    </ContextMenuSub>
  );
});
