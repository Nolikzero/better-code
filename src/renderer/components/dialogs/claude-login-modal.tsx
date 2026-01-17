"use client"

import { useAtom } from "jotai"
import { useState } from "react"
import { Check, Copy, Terminal, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogCancel,
} from "../ui/alert-dialog"
import { ClaudeCodeIcon } from "../ui/icons"
import { Logo } from "../ui/logo"
import { agentsLoginModalOpenAtom } from "../../lib/atoms"
import { pendingAuthRetryMessageAtom } from "../../features/agents/atoms"
import { appStore } from "../../lib/jotai-store"

export function ClaudeLoginModal() {
  const [open, setOpen] = useAtom(agentsLoginModalOpenAtom)
  const [copied, setCopied] = useState(false)

  const handleCopyCommand = async () => {
    await navigator.clipboard.writeText("claude login")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Clear pending retry when modal is dismissed
  const clearPendingRetry = () => {
    const pending = appStore.get(pendingAuthRetryMessageAtom)
    if (pending && !pending.readyToRetry) {
      appStore.set(pendingAuthRetryMessageAtom, null)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      clearPendingRetry()
    }
    setOpen(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="w-[380px] p-6">
        {/* Close button */}
        <AlertDialogCancel className="absolute right-4 top-4 h-6 w-6 p-0 border-0 bg-transparent hover:bg-muted rounded-sm opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </AlertDialogCancel>

        <div className="space-y-6">
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
                Authentication Required
              </h1>
              <p className="text-sm text-muted-foreground">
                Please authenticate with Claude Code CLI
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Run the following command in your terminal:
            </p>
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
            <p className="text-xs text-muted-foreground text-center">
              After authenticating, close this dialog and try your message again.
            </p>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
