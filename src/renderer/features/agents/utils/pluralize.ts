/**
 * Simple pluralization utility for count-based text formatting
 *
 * @param count - The number to determine singular/plural
 * @param singular - The singular form of the word
 * @param plural - Optional custom plural form. If not provided, adds 's' to singular
 * @returns The appropriate singular or plural form
 *
 * @example
 * pluralize(1, "agent") // "agent"
 * pluralize(2, "agent") // "agents"
 * pluralize(1, "subchat", "subchats") // "subchat"
 * pluralize(5, "subchat", "subchats") // "subchats"
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  return count === 1 ? singular : plural || `${singular}s`
}
