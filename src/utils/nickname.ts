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

// Lowercase, remove spaces, map leet, so disguised profanities still match
function normalizeForProfanity(input: string): string {
  return [...input.toLowerCase().replace(/\s+/g, "")]
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
}

// Display names are ASCII letters, digits and spaces only
export function sanitizeNickname(rawInput: string | null | undefined): string {
  const spaced = normalizeWhitespace(rawInput ?? "");
  return normalizeWhitespace(spaced.replace(/[^A-Za-z0-9 ]/g, ""));
}

export function validateNickname(rawInput: string | null | undefined): {
  isValid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];
  const sanitized = sanitizeNickname(rawInput);

  if (!sanitized) {
    errors.push("Pick a nickname.");
  }

  // Reject rather than silently strip symbols, emoji and non-ASCII
  if (/[^A-Za-z0-9\s]/.test(rawInput ?? "")) {
    errors.push("Letters, numbers and spaces only.");
  }

  if (sanitized.length < 3 || sanitized.length > 20) {
    errors.push("Must be 3–20 characters.");
  }

  const normalized = normalizeForProfanity(sanitized);
  if (PROFANITY_BLOCKLIST.some((bad) => normalized.includes(bad))) {
    errors.push("Keep it clean. Try another name.");
  }

  return { isValid: errors.length === 0, sanitized, errors };
}

export const NICKNAME_RULE_HINT = "3–20 letters, numbers or spaces.";

const NICKNAME_KEY = "stt-nickname";

export function loadSavedNickname(): string | null {
  try {
    return localStorage.getItem(NICKNAME_KEY);
  } catch {
    return null;
  }
}

export function saveNickname(nickname: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    // storage unavailable: nickname just isn't remembered
  }
}
