import type { IBufferLine, ILink, ILinkProvider, Terminal as XTerm } from "xterm"
import { isModifierPressed, showLinkPopup, removeLinkPopup } from "./link-popup"

/**
 * File path link provider for xterm.js.
 * Detects file paths with optional line and column numbers and makes them clickable.
 * Requires Cmd+Click (Mac) or Ctrl+Click (Windows/Linux) to activate.
 *
 * Supported formats:
 * - /absolute/path/to/file.ts
 * - /absolute/path/to/file.ts:10
 * - /absolute/path/to/file.ts:10:5
 * - ./relative/path/file.ts
 * - ./relative/path/file.ts:10:5
 * - ../parent/path/file.ts:10
 */

// Pattern for file paths with optional line:column
// Matches:
// - Absolute paths starting with /
// - Relative paths starting with ./ or ../
// - Optionally followed by :line or :line:column
const FILE_PATH_PATTERN =
  /(?:^|[\s'"({\[])((?:\.\.?\/|\/)[^\s:'")\]}>]+?)(?::(\d+))?(?::(\d+))?(?=[\s'")\]}>]|$)/g

/**
 * Get the text content of a buffer line.
 */
function getLineText(line: IBufferLine): string {
  let text = ""
  for (let i = 0; i < line.length; i++) {
    text += line.getCell(i)?.getChars() || " "
  }
  return text
}

/**
 * Check if a path looks like a file (has an extension or is a dotfile).
 */
function looksLikeFile(path: string): boolean {
  const basename = path.split("/").pop() || ""

  // Has an extension
  if (/\.[a-zA-Z0-9]+$/.test(basename)) {
    return true
  }

  // Is a dotfile
  if (basename.startsWith(".") && basename.length > 1) {
    return true
  }

  // Common extensionless files
  const extensionlessFiles = [
    "Makefile",
    "Dockerfile",
    "Vagrantfile",
    "Gemfile",
    "Rakefile",
    "LICENSE",
    "README",
    "CHANGELOG",
    "AUTHORS",
    "CONTRIBUTING",
  ]

  if (extensionlessFiles.includes(basename)) {
    return true
  }

  return false
}

export class FilePathLinkProvider implements ILinkProvider {
  constructor(
    private xterm: XTerm,
    private onClick: (
      event: MouseEvent,
      path: string,
      line?: number,
      column?: number
    ) => void
  ) {}

  provideLinks(
    bufferLineNumber: number,
    callback: (links: ILink[] | undefined) => void
  ): void {
    const buffer = this.xterm.buffer.active
    const line = buffer.getLine(bufferLineNumber)

    if (!line) {
      callback(undefined)
      return
    }

    const lineText = getLineText(line)
    const links: ILink[] = []

    let match: RegExpExecArray | null
    FILE_PATH_PATTERN.lastIndex = 0

    while ((match = FILE_PATH_PATTERN.exec(lineText)) !== null) {
      const fullMatch = match[0]
      const path = match[1]
      const lineNum = match[2] ? parseInt(match[2], 10) : undefined
      const colNum = match[3] ? parseInt(match[3], 10) : undefined

      // Skip if it doesn't look like a file
      if (!looksLikeFile(path)) {
        continue
      }

      // Calculate the actual start position (accounting for leading whitespace/quote)
      const leadingChars = fullMatch.length - path.length - (match[2] ? match[2].length + 1 : 0) - (match[3] ? match[3].length + 1 : 0)
      const startX = match.index + leadingChars

      // Build the link text (path with optional :line:col)
      let linkText = path
      if (lineNum !== undefined) {
        linkText += `:${lineNum}`
        if (colNum !== undefined) {
          linkText += `:${colNum}`
        }
      }

      const endX = startX + linkText.length

      links.push({
        range: {
          start: { x: startX + 1, y: bufferLineNumber + 1 },
          end: { x: endX + 1, y: bufferLineNumber + 1 },
        },
        text: linkText,
        decorations: {
          pointerCursor: true,
          underline: true,
        },
        activate: (event: MouseEvent) => {
          // Require Cmd+Click (Mac) or Ctrl+Click (Windows/Linux)
          if (isModifierPressed(event)) {
            this.onClick(event, path, lineNum, colNum)
          }
        },
        hover: (event: MouseEvent, text: string) => {
          showLinkPopup(event, text)
        },
        leave: () => {
          removeLinkPopup()
        },
      })
    }

    callback(links.length > 0 ? links : undefined)
  }
}
