"use client";

import { useSetAtom } from "jotai";
import { Check, Copy, Terminal } from "lucide-react";
import { useState } from "react";

import { ClaudeCodeIcon } from "../../components/ui/icons";
import { Logo } from "../../components/ui/logo";
import { anthropicOnboardingCompletedAtom } from "../../lib/atoms";

export function AnthropicOnboardingPage() {
  const [copied, setCopied] = useState(false);
  const setAnthropicOnboardingCompleted = useSetAtom(
    anthropicOnboardingCompletedAtom,
  );

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText("claude login");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    setAnthropicOnboardingCompleted(true);
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background select-none">
      {/* Draggable title bar area */}
      <div
        className="fixed top-0 left-0 right-0 h-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div className="w-full max-w-[440px] space-y-8 px-4">
        {/* Header with dual icons */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 p-2 mx-auto w-max rounded-full border border-border">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Logo className="w-5 h-5" fill="white" />
            </div>
            <div className="w-10 h-10 rounded-full bg-[#D97757] flex items-center justify-center">
              <ClaudeCodeIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold tracking-tight">
              Connect Claude Code
            </h1>
            <p className="text-sm text-muted-foreground">
              Authenticate with Claude Code CLI to get started
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
                1
              </div>
              <p className="text-muted-foreground">Open Terminal</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-muted-foreground">Run the login command:</p>
                <button
                  onClick={handleCopyCommand}
                  className="flex items-center gap-2 w-full px-3 py-2 bg-muted rounded-lg font-mono text-sm hover:bg-muted/80 transition-colors"
                >
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 text-left">claude login</span>
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
                3
              </div>
              <p className="text-muted-foreground">
                Complete authentication in your browser
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
                4
              </div>
              <p className="text-muted-foreground">
                Return here and click Continue
              </p>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full h-8 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)] flex items-center justify-center"
          >
            Continue
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Make sure you've completed the authentication in Terminal before
            continuing.
          </p>
        </div>
      </div>
    </div>
  );
}
