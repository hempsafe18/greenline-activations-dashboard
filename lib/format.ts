// Standard capitalization for text that lands in the events table from client
// requests, so "total wine - orlando" and "TOTAL WINE" both read the same as
// hand-entered events ("Total Wine - Orlando").

const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

// Title case for names (venue, store, event title). Only words typed entirely
// in lowercase are fixed, so acronyms and brand casing that are already
// mixed/upper ("3CHI", "THC", "McDonald's") survive. If the whole string is
// ALL CAPS it is treated as shouting and normalized.
export function toTitleCase(input: string | null | undefined): string {
  const s = (input ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const shouting = s === s.toUpperCase() && /[A-Z]{2}/.test(s);
  const src = shouting ? s.toLowerCase() : s;
  return src
    .split(' ')
    .map((word, i) =>
      word
        .split(/([-/])/)
        .map(part => {
          if (part === '-' || part === '/') return part;
          if (part !== part.toLowerCase()) return part;
          if (i > 0 && SMALL_WORDS.has(part)) return part;
          return part.replace(/^([^a-z]*)([a-z])/, (_, pre, ch) => pre + ch.toUpperCase());
        })
        .join('')
    )
    .join(' ');
}

// Sentence case for free text (descriptions): trims, and capitalizes the first
// letter of the text and of each sentence. Everything else is left as typed.
export function toSentenceCase(input: string | null | undefined): string {
  const s = (input ?? '').trim();
  if (!s) return '';
  return s.replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase());
}
