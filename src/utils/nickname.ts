// Centralized utilities for validating and sanitizing player display names (nicknames)

// Basic PG profanity blocklist. This is intentionally minimal and can be expanded.
// We apply this after normalizing to lowercase, removing spaces, and leetspeak mapping.
const PROFANITY_BLOCKLIST: string[] = [
  // Common English profanities (keep short and simple)
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "cunt",
  "pussy",
  "slut",
  "whore",
  // Racist/derogatory (avoid listing extensively; include basic catches)
  "nigger",
  "nigga",
  "chink",
  "spic",
  "kike",
  // Sexual content
  "porn",
  "xxx",
];

// Map common leetspeak numerals/letters to letters to catch disguised profanities
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  l: "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  $: "s",
  "7": "t",
  "+": "t",
  "8": "b",
  "9": "g",
};

// Collapse repeated whitespace and trim
function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

// Strip non-ASCII characters (display names restricted to ASCII A–Z, a–z, 0–9, space)
function stripNonAscii(input: string): string {
  // Remove any non-ASCII characters using Unicode property escapes
  return input.replace(/[^\p{ASCII}]/gu, "");
}

// Remove all non alphanumeric/space characters
function removeSymbols(input: string): string {
  return input.replace(/[^A-Za-z0-9 ]/g, "");
}

// Convert to a form suitable for profanity detection: lowercase, remove spaces, map leet
function normalizeForProfanity(input: string): string {
  const lower = input.toLowerCase();
  const noSpaces = lower.replace(/\s+/g, "");
  let mapped = "";
  for (const ch of noSpaces) {
    mapped += LEET_MAP[ch] ?? ch;
  }
  return mapped;
}

export function sanitizeNickname(rawInput: string | null | undefined): string {
  const base = (rawInput ?? "").toString();
  // Step 1: Trim + collapse spaces
  let sanitized = normalizeWhitespace(base);
  // Step 2: Strip non-ASCII
  sanitized = stripNonAscii(sanitized);
  // Step 3: Remove symbols, keep letters, digits, spaces
  sanitized = removeSymbols(sanitized);
  // Step 4: Collapse spaces again after stripping
  sanitized = normalizeWhitespace(sanitized);
  return sanitized;
}

export function validateNickname(rawInput: string | null | undefined): {
  isValid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];
  const sanitized = sanitizeNickname(rawInput);
  const raw = (rawInput ?? "").toString();
  const rawWhitespaceNormalized = normalizeWhitespace(raw);

  if (!sanitized) {
    errors.push("Display name is required.");
  }

  // Enforce allowed characters: letters, digits, spaces only (check RAW input too)
  // If the user typed any disallowed characters (symbols/emojis/non-ASCII), reject.
  if (rawWhitespaceNormalized) {
    const containsNonAscii = /[^\p{ASCII}]/u.test(rawWhitespaceNormalized);
    const containsSymbols = /[^A-Za-z0-9 ]/.test(rawWhitespaceNormalized);
    if (containsNonAscii || containsSymbols) {
      errors.push("Only letters, numbers, and spaces are allowed.");
    }
  }

  // Length constraints after sanitization
  if (sanitized.length < 3 || sanitized.length > 20) {
    errors.push("Must be 3–20 characters long.");
  }

  // Profanity check
  const normalized = normalizeForProfanity(sanitized);
  for (const bad of PROFANITY_BLOCKLIST) {
    if (normalized.includes(bad)) {
      errors.push("Please choose a different, family-friendly display name.");
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}

export function getNicknameRuleHint(): string {
  return "3–20 chars; letters, numbers, and spaces only.";
}
