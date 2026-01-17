/**
 * Terminal escape sequence filter for handling special sequences like clear scrollback.
 */

// ESC [ 3 J - Clear scrollback buffer (used by Cmd+K / clear command)
const CLEAR_SCROLLBACK_SEQUENCES = [
  "\x1b[3J", // Standard clear scrollback
  "\x1b[2J\x1b[3J", // Clear screen + clear scrollback
  "\x1b[H\x1b[2J\x1b[3J", // Move cursor home + clear screen + clear scrollback
]

/**
 * Check if the data contains a clear scrollback sequence.
 * This is typically sent when user presses Cmd+K or runs 'clear' command.
 */
export function containsClearScrollbackSequence(data: string): boolean {
  return CLEAR_SCROLLBACK_SEQUENCES.some((seq) => data.includes(seq))
}

/**
 * Extract content after the clear scrollback sequence.
 * Returns the remaining content that should be kept after the clear.
 */
export function extractContentAfterClear(data: string): string {
  // Find the last occurrence of any clear sequence
  let lastIndex = -1
  let seqLength = 0

  for (const seq of CLEAR_SCROLLBACK_SEQUENCES) {
    const idx = data.lastIndexOf(seq)
    if (idx > lastIndex) {
      lastIndex = idx
      seqLength = seq.length
    }
  }

  if (lastIndex === -1) {
    return data
  }

  // Return everything after the clear sequence
  return data.slice(lastIndex + seqLength)
}
