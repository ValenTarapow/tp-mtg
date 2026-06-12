export function parseDeckLine(line) {
  return line
    .trim()
    .replace(/^\s*\d+\s*x?\s+/i, '')
    .trim();
}

export function parseCardList(text) {
  return text
    .split(/\r?\n/)
    .map(parseDeckLine)
    .filter(Boolean);
}
