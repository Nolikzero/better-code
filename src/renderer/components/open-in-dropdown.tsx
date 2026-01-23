"use client";

import type { ExternalApp } from "@shared/types";
import { ExternalLink } from "lucide-react";
import { memo } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { getEditorIcon } from "./ui/editor-icons";

interface OpenInDropdownProps {
  path: string;
}

const CATEGORY_ORDER: ExternalApp["category"][] = [
  "file-manager",
  "editor",
  "ide",
  "terminal",
];

export const OpenInDropdown = memo(function OpenInDropdown({
  path,
}: OpenInDropdownProps) {
  const { data, isLoading } = trpc.external.getInstalledApps.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 },
  );
  const openMutation = trpc.external.openInSpecificApp.useMutation();

  const apps = data?.apps ?? [];

  const grouped: Record<string, ExternalApp[]> = {};
  for (const app of apps) {
    if (!grouped[app.category]) grouped[app.category] = [];
    grouped[app.category].push(app);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground shrink-0 rounded-md ml-2"
          aria-label="Open in..."
          disabled={!isLoading && apps.length === 0}
          title="Open in..."
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
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
              {showSeparator && <DropdownMenuSeparator />}
              {categoryApps.map((app) => (
                <DropdownMenuItem
                  key={app.id}
                  onClick={() => openMutation.mutate({ appId: app.id, path })}
                  className="gap-2"
                >
                  {getEditorIcon(app.id, "h-4 w-4 shrink-0")}
                  <span>{app.name}</span>
                </DropdownMenuItem>
              ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
