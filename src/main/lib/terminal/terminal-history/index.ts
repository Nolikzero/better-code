import fs from "node:fs/promises"
import path from "node:path"
import { app } from "electron"

const MAX_SCROLLBACK_CHARS = 500_000

/**
 * Get the directory for terminal history files.
 */
function getHistoryDir(): string {
  return path.join(app.getPath("userData"), "terminal-history")
}

/**
 * Get the path for a specific terminal's history file.
 */
function getHistoryPath(workspaceId: string, paneId: string): string {
  // Sanitize IDs to prevent path traversal
  const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9-_]/g, "_")
  const safePaneId = paneId.replace(/[^a-zA-Z0-9-_]/g, "_")
  return path.join(getHistoryDir(), safeWorkspaceId, `${safePaneId}.txt`)
}

/**
 * Writes terminal output to disk for persistence across app restarts.
 */
export class HistoryWriter {
  private workspaceId: string
  private paneId: string
  private cwd: string
  private cols: number
  private rows: number
  private filePath: string
  private buffer: string = ""
  private flushTimeout: ReturnType<typeof setTimeout> | null = null
  private isInitialized = false

  constructor(
    workspaceId: string,
    paneId: string,
    cwd: string,
    cols: number,
    rows: number
  ) {
    this.workspaceId = workspaceId
    this.paneId = paneId
    this.cwd = cwd
    this.cols = cols
    this.rows = rows
    this.filePath = getHistoryPath(workspaceId, paneId)
  }

  /**
   * Initialize the history file with optional existing scrollback.
   */
  async init(existingScrollback?: string): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.filePath), { recursive: true })

      // Write header and existing scrollback
      const header = `# Terminal History\n# Workspace: ${this.workspaceId}\n# Pane: ${this.paneId}\n# CWD: ${this.cwd}\n# Size: ${this.cols}x${this.rows}\n# Created: ${new Date().toISOString()}\n---\n`

      if (existingScrollback) {
        await fs.writeFile(this.filePath, header + existingScrollback, "utf-8")
      } else {
        await fs.writeFile(this.filePath, header, "utf-8")
      }

      this.isInitialized = true
    } catch (err) {
      console.error("[HistoryWriter] Failed to init:", err)
    }
  }

  /**
   * Write data to the history buffer. Flushes to disk periodically.
   */
  write(data: string): void {
    if (!this.isInitialized) return

    this.buffer += data

    // Schedule flush if not already scheduled
    if (this.flushTimeout === null) {
      this.flushTimeout = setTimeout(() => this.flush(), 1000)
    }
  }

  /**
   * Flush buffer to disk.
   */
  private async flush(): Promise<void> {
    if (this.flushTimeout !== null) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }

    if (!this.buffer || !this.isInitialized) return

    const dataToWrite = this.buffer
    this.buffer = ""

    try {
      await fs.appendFile(this.filePath, dataToWrite, "utf-8")
    } catch (err) {
      console.error("[HistoryWriter] Failed to flush:", err)
    }
  }

  /**
   * Close the history writer, flushing any remaining data.
   */
  async close(exitCode?: number): Promise<void> {
    await this.flush()

    if (exitCode !== undefined) {
      try {
        await fs.appendFile(
          this.filePath,
          `\n---\n# Exited: ${new Date().toISOString()}\n# Exit code: ${exitCode}\n`,
          "utf-8"
        )
      } catch {
        // Ignore
      }
    }

    this.isInitialized = false
  }
}

/**
 * Reads terminal history from disk.
 */
export class HistoryReader {
  private workspaceId: string
  private paneId: string
  private filePath: string

  constructor(workspaceId: string, paneId: string) {
    this.workspaceId = workspaceId
    this.paneId = paneId
    this.filePath = getHistoryPath(workspaceId, paneId)
  }

  /**
   * Read the scrollback history from disk.
   */
  async read(): Promise<{ scrollback: string }> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8")

      // Remove header (everything before ---\n)
      const headerEnd = content.indexOf("---\n")
      if (headerEnd === -1) {
        return { scrollback: "" }
      }

      let scrollback = content.slice(headerEnd + 4)

      // Remove exit footer if present
      const exitFooterStart = scrollback.lastIndexOf("\n---\n# Exited:")
      if (exitFooterStart !== -1) {
        scrollback = scrollback.slice(0, exitFooterStart)
      }

      // Limit scrollback size
      if (scrollback.length > MAX_SCROLLBACK_CHARS) {
        scrollback = scrollback.slice(-MAX_SCROLLBACK_CHARS)
      }

      return { scrollback }
    } catch (err) {
      // File doesn't exist or can't be read
      return { scrollback: "" }
    }
  }

  /**
   * Delete the history file.
   */
  async cleanup(): Promise<void> {
    try {
      await fs.unlink(this.filePath)
    } catch {
      // Ignore - file may not exist
    }
  }
}
