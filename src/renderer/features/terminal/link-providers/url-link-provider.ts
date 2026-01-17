import type { IBufferLine, ILink, ILinkProvider, Terminal as XTerm } from "xterm"
import { isModifierPressed, showLinkPopup, removeLinkPopup } from "./link-popup"

/**
 * URL link provider for xterm.js.
 * Detects URLs in terminal output and makes them clickable.
 * Requires Cmd+Click (Mac) or Ctrl+Click (Windows/Linux) to activate.
 */

// URL pattern that matches http, https, and file URLs
const URL_PATTERN =
  /https?:\/\/[^\s<>"\])}]+|file:\/\/[^\s<>"\])}]+/gi

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

export class UrlLinkProvider implements ILinkProvider {
  constructor(
    private xterm: XTerm,
    private onClick: (event: MouseEvent, uri: string) => void
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
    URL_PATTERN.lastIndex = 0

    while ((match = URL_PATTERN.exec(lineText)) !== null) {
      const startX = match.index
      const url = match[0]

      // Clean up trailing punctuation that's likely not part of the URL
      const cleanUrl = url.replace(/[.,;:!?)]+$/, "")
      const endX = startX + cleanUrl.length

      links.push({
        range: {
          start: { x: startX + 1, y: bufferLineNumber + 1 },
          end: { x: endX + 1, y: bufferLineNumber + 1 },
        },
        text: cleanUrl,
        decorations: {
          pointerCursor: true,
          underline: true,
        },
        activate: (event: MouseEvent, text: string) => {
          // Require Cmd+Click (Mac) or Ctrl+Click (Windows/Linux)
          if (isModifierPressed(event)) {
            this.onClick(event, text)
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
