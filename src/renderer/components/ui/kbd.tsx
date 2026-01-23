import * as React from "react";
import { cn } from "../../lib/utils";
import { CmdIcon, EnterIcon, OptionIcon, ShiftIcon } from "./icons";

interface KbdProps extends React.HTMLAttributes<HTMLElement> {}

function isMacPlatform(): boolean {
  if (
    typeof window !== "undefined" &&
    (window as { desktopApi?: { platform?: string } }).desktopApi?.platform
  ) {
    return (
      (window as { desktopApi?: { platform?: string } }).desktopApi
        ?.platform === "darwin"
    );
  }
  return typeof navigator !== "undefined"
    ? /Mac/.test(navigator.platform)
    : false;
}

/** Parse shortcut string and replace modifier symbols with icons/text */
function renderShortcut(children: React.ReactNode): React.ReactNode {
  if (typeof children !== "string") return children;

  const parts: React.ReactNode[] = [];
  const isMac = isMacPlatform();

  if (isMac) {
    // macOS: Use icons for modifier symbols
    const symbolMap: Record<string, React.ReactNode> = {
      "⌘": <CmdIcon key="cmd" className="h-3 w-3" />,
      "⌥": <OptionIcon key="opt" className="h-3 w-3" />,
      "⇧": <ShiftIcon key="shift" className="h-3 w-3" />,
      "⌃": <span key="ctrl">⌃</span>,
      "↵": <EnterIcon key="enter" className="h-3 w-3" />,
    };

    const regex = /([⌘⌥⇧⌃↵])/g;
    const tokens = children.split(regex);

    tokens.forEach((token, index) => {
      if (symbolMap[token]) {
        parts.push(symbolMap[token]);
      } else if (token) {
        parts.push(<span key={index}>{token}</span>);
      }
    });
  } else {
    // Windows/Linux: Replace symbols with text labels
    const textMap: Record<string, string> = {
      "⌘": "Ctrl",
      "⌥": "Alt",
      "⇧": "Shift",
      "⌃": "Ctrl",
      "↵": "Enter",
    };

    const regex = /([⌘⌥⇧⌃↵])/g;
    const tokens = children.split(regex);

    tokens.forEach((token, index) => {
      if (textMap[token]) {
        parts.push(
          <span key={index}>
            {textMap[token]}
            {/* Add separator if next token is not empty */}
          </span>,
        );
      } else if (token) {
        parts.push(<span key={index}>{token}</span>);
      }
    });
  }

  return parts;
}

const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={cn(
          "pointer-events-none inline-flex items-center gap-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/60",
          className,
        )}
        {...props}
      >
        {renderShortcut(children)}
      </kbd>
    );
  },
);
Kbd.displayName = "Kbd";

export { Kbd };
