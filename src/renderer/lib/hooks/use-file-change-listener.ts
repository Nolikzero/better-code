import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

/**
 * Hook that listens for file changes from Claude Write/Edit tools
 * and invalidates the git status query to trigger a refetch
 */
export function useFileChangeListener(worktreePath: string | null | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!worktreePath) return

    const cleanup = window.desktopApi?.onFileChanged((data) => {
      // Check if the changed file is within our worktree
      if (data.filePath.startsWith(worktreePath)) {
        // Invalidate git status queries to trigger refetch
        queryClient.invalidateQueries({
          queryKey: [["changes", "getStatus"]],
        })
      }
    })

    return () => {
      cleanup?.()
    }
  }, [worktreePath, queryClient])
}
