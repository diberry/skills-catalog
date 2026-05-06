/**
 * Shared text normalization and extraction utilities
 */

/**
 * Normalize line endings to \n (handles CRLF and LF)
 * @param {string} content - Text content with any line ending style
 * @returns {string} Content with normalized \n line endings
 */
export function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Extract list items from a markdown section
 * @param {string} content - Markdown body (should be normalized)
 * @param {RegExp} headerPattern - Pattern for section header
 * @returns {string[]} Extracted list items
 */
export function extractMarkdownSectionItems(content, headerPattern) {
  const items = [];
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split('\n');
  let inSection = false;

  for (const line of lines) {
    if (headerPattern.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) {
      break;
    }
    if (inSection && line.trim().startsWith('-')) {
      const item = line.replace(/^-\s*/, '').trim();
      if (item) items.push(item);
    }
  }

  return items;
}
