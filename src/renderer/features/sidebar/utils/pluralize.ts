/**
 * Pluralize a word based on count
 * @param count - The number of items
 * @param singular - The singular form of the word
 * @param plural - Optional plural form (defaults to singular + 's')
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  if (count === 1) {
    return singular
  }
  return plural || `${singular}s`
}
