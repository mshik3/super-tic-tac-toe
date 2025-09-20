import { describe, expect, it } from "vitest";
import { sanitizeNickname, validateNickname } from "./nickname";

describe("sanitizeNickname", () => {
  it("trims and collapses spaces", () => {
    expect(sanitizeNickname("  John   Doe  ")).toBe("John Doe");
  });

  it("removes non-ASCII characters", () => {
    expect(sanitizeNickname("Jöhn Dôe")).toBe("Jhn De");
  });

  it("removes symbols but keeps letters, numbers, spaces", () => {
    expect(sanitizeNickname("John_Doe!#123")).toBe(
      "JohnDoe 123".replace(" ", "")
    );
  });
});

describe("validateNickname", () => {
  it("rejects empty", () => {
    const r = validateNickname("");
    expect(r.isValid).toBe(false);
    expect(r.errors[0]).toMatch(/required/i);
  });

  it("rejects too short and too long", () => {
    expect(validateNickname("Jo").isValid).toBe(false);
    expect(validateNickname("J".repeat(21)).isValid).toBe(false);
  });

  it("accepts allowed characters and spaces", () => {
    const r = validateNickname("Alice Bob 123");
    expect(r.isValid).toBe(true);
    expect(r.sanitized).toBe("Alice Bob 123");
  });

  it("rejects symbols and emojis", () => {
    expect(validateNickname("Alice!").isValid).toBe(false);
    expect(validateNickname("Alice😀").isValid).toBe(false);
  });

  it("blocks basic profanity and leetspeak variants", () => {
    expect(validateNickname("sh1t").isValid).toBe(false);
    expect(validateNickname("f u c k").isValid).toBe(false);
    expect(validateNickname("p0rn").isValid).toBe(false);
  });

  it("returns sanitized value on success", () => {
    const r = validateNickname("  Bob   77  ");
    expect(r.isValid).toBe(true);
    expect(r.sanitized).toBe("Bob 77");
  });
});
