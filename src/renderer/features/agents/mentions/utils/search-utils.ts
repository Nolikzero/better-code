/**
 * Search and filtering utilities for mentions
 */

/**
 * Check if a string matches all search words (multi-word search)
 * Splits search by whitespace, all words must be present in target
 */
export function matchesMultiWordSearch(
  target: string,
  searchLower: string,
): boolean {
  if (!searchLower) return true;
  const searchWords = searchLower.split(/\s+/).filter(Boolean);
  if (searchWords.length === 0) return true;
  const targetLower = target.toLowerCase();
  return searchWords.every((word) => targetLower.includes(word));
}

/**
 * Score how well query path segments match a file path.
 * Returns number of skipped intermediate segments (-1 = no match).
 * Note: intentionally duplicated from file-index.ts (backend vs frontend).
 */
function pathSegmentScore(querySegments: string[], filePath: string): number {
  const pathSegments = filePath.toLowerCase().split("/");
  let qi = 0;
  let skipped = 0;
  for (
    let pi = 0;
    pi < pathSegments.length && qi < querySegments.length;
    pi++
  ) {
    if (pathSegments[pi].includes(querySegments[qi])) {
      qi++;
    } else if (qi > 0) {
      skipped++;
    }
  }
  return qi === querySegments.length ? skipped : -1;
}

/**
 * Sort files by relevance to search query
 * Priority: exact match > starts with > shorter match > contains in filename > alphabetical
 * Supports multi-word search - splits by whitespace, all words must match
 * When search ends with space, prioritize files with hyphen/underscore (e.g. "agents " -> "agents-sidebar")
 */
export function sortFilesByRelevance<
  T extends { label: string; path?: string },
>(files: T[], searchText: string): T[] {
  if (!searchText) return files;

  // Path-segment sorting: when query contains `/`, sort by segment proximity
  if (searchText.includes("/") && files[0]?.path) {
    const segments = searchText.toLowerCase().split("/").filter(Boolean);
    return [...files].sort((a, b) => {
      const aScore = pathSegmentScore(segments, a.path ?? a.label);
      const bScore = pathSegmentScore(segments, b.path ?? b.label);
      // Non-matches (-1) sort last
      if (aScore === -1 && bScore === -1)
        return (a.path ?? a.label).length - (b.path ?? b.label).length;
      if (aScore === -1) return 1;
      if (bScore === -1) return -1;
      if (aScore !== bScore) return aScore - bScore;
      return (a.path ?? a.label).length - (b.path ?? b.label).length;
    });
  }

  const searchLower = searchText.toLowerCase();
  const searchWords = searchLower.split(/\s+/).filter(Boolean);
  const isSingleWord = searchWords.length <= 1;
  // Check if search ends with space - user wants to continue with hyphenated names
  const endsWithSpace = searchText.endsWith(" ");

  return [...files].sort((a, b) => {
    const aLabelLower = a.label.toLowerCase();
    const bLabelLower = b.label.toLowerCase();

    // Get filename without extension for matching
    const aNameNoExt = aLabelLower.replace(/\.[^.]+$/, "");
    const bNameNoExt = bLabelLower.replace(/\.[^.]+$/, "");

    // For multi-word search, prioritize files where all words match in filename
    if (!isSingleWord) {
      const aAllInFilename = searchWords.every((w) => aLabelLower.includes(w));
      const bAllInFilename = searchWords.every((w) => bLabelLower.includes(w));
      if (aAllInFilename && !bAllInFilename) return -1;
      if (!aAllInFilename && bAllInFilename) return 1;
    }

    // When search ends with space, prioritize files with hyphen/underscore after first word
    // e.g. "agents " should show "agents-sidebar" before "agents" folder
    if (endsWithSpace && searchWords.length >= 1) {
      const lastWord = searchWords[searchWords.length - 1];
      // Check if filename has hyphen/underscore continuation after matching word
      const aHasContinuation =
        aNameNoExt.includes(`${lastWord}-`) ||
        aNameNoExt.includes(`${lastWord}_`);
      const bHasContinuation =
        bNameNoExt.includes(`${lastWord}-`) ||
        bNameNoExt.includes(`${lastWord}_`);
      if (aHasContinuation && !bHasContinuation) return -1;
      if (!aHasContinuation && bHasContinuation) return 1;
    }

    // Priority 1: EXACT match (chat.tsx when searching "chat") - single word only, not when ending with space
    if (isSingleWord && !endsWithSpace) {
      const aExact = aNameNoExt === searchLower;
      const bExact = bNameNoExt === searchLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
    }

    // Priority 2: filename STARTS with first search word
    const firstWord = searchWords[0] || searchLower;
    const aStartsWith = aNameNoExt.startsWith(firstWord);
    const bStartsWith = bNameNoExt.startsWith(firstWord);
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    // Priority 3: If both start with query, shorter name = higher match %
    // But when ending with space, prefer longer (hyphenated) names
    if (aStartsWith && bStartsWith) {
      if (aNameNoExt.length !== bNameNoExt.length) {
        if (endsWithSpace) {
          return bNameNoExt.length - aNameNoExt.length; // longer first when space at end
        }
        return aNameNoExt.length - bNameNoExt.length; // shorter first normally
      }
    }

    // Priority 4: filename CONTAINS first word (but doesn't start with it)
    const aFilenameMatch = aLabelLower.includes(firstWord);
    const bFilenameMatch = bLabelLower.includes(firstWord);
    if (aFilenameMatch && !bFilenameMatch) return -1;
    if (!aFilenameMatch && bFilenameMatch) return 1;

    // Finally: alphabetically by label
    return a.label.localeCompare(b.label);
  });
}
