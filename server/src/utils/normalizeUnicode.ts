/**
 * Unicode normalization for security pattern matching.
 * Addresses RR-4: homoglyph substitution bypass of jailbreak filters.
 *
 * Two-step defense:
 *   1. NFKC normalization — collapses fullwidth chars (ｉｇｎｏｒｅ → ignore),
 *      ligatures (ﬁ → fi), and combining sequences.
 *   2. Confusable character mapping — replaces common Cyrillic/Greek
 *      lookalikes with their Latin equivalents.
 */

// Common Unicode confusables: visually identical to Latin but different codepoints.
// Source: Unicode Confusable Characters (TR39)
const CONFUSABLES: Record<string, string> = {
  // Cyrillic → Latin
  '\u0430': 'a', // а
  '\u0435': 'e', // е
  '\u0456': 'i', // і
  '\u043E': 'o', // о
  '\u0440': 'p', // р
  '\u0441': 'c', // с
  '\u0443': 'y', // у (Cyrillic у looks like Latin y)
  '\u0445': 'x', // х
  '\u0455': 's', // ѕ
  '\u0458': 'j', // ј
  '\u04BB': 'h', // һ
  '\u0410': 'A', // А
  '\u0412': 'B', // В
  '\u0415': 'E', // Е
  '\u041A': 'K', // К
  '\u041C': 'M', // М
  '\u041D': 'H', // Н
  '\u041E': 'O', // О
  '\u0420': 'P', // Р
  '\u0421': 'C', // С
  '\u0422': 'T', // Т
  '\u0425': 'X', // Х
  '\u0427': 'Y', // Ч → not a perfect match, but common confusion

  // Greek → Latin
  '\u03B1': 'a', // α
  '\u03B5': 'e', // ε
  '\u03BF': 'o', // ο
  '\u03C1': 'p', // ρ
  '\u03C4': 't', // τ
  '\u03BD': 'v', // ν
  '\u0391': 'A', // Α
  '\u0392': 'B', // Β
  '\u0395': 'E', // Ε
  '\u0397': 'H', // Η
  '\u0399': 'I', // Ι
  '\u039A': 'K', // Κ
  '\u039C': 'M', // Μ
  '\u039D': 'N', // Ν
  '\u039F': 'O', // Ο
  '\u03A1': 'P', // Ρ
  '\u03A4': 'T', // Τ
  '\u03A5': 'Y', // Υ
  '\u03A7': 'X', // Χ

  // Other common confusables
  '\u2113': 'l', // ℓ (script small l)
  '\uFF41': 'a', // ａ (fullwidth — NFKC handles these, but belt-and-suspenders)
  '\u0131': 'i', // ı (dotless i)
  '\u01C0': 'l', // ǀ (dental click → looks like l)
};

// Build a single regex that matches any confusable character
const CONFUSABLE_REGEX = new RegExp(
  '[' + Object.keys(CONFUSABLES).map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('') + ']',
  'g'
);

// Zero-width and invisible characters that can break pattern matching
const INVISIBLE_CHARS = /[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD\u034F\u061C\u2060\u2061\u2062\u2063\u2064\u206A-\u206F]/g;

/**
 * Normalize a string for security pattern matching.
 * Does NOT modify the original message — use the returned string only for detection.
 */
export function normalizeForPatternMatch(text: string): string {
  return text
    .normalize('NFKC')                                    // Step 1: canonical decomposition + compatibility composition
    .replace(INVISIBLE_CHARS, '')                         // Step 2: strip zero-width / invisible chars
    .replace(CONFUSABLE_REGEX, ch => CONFUSABLES[ch] || ch); // Step 3: map confusable chars to Latin
}
