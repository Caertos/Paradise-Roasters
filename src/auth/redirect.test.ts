import { describe, expect, it } from "vitest";
import { DEFAULT_AUTHENTICATED_PATH, safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it.each(["/user", "/user?tab=x", "/user?tab=x#top", "/"])(
    "accepts the same-origin path %j",
    (raw) => {
      expect(safeRedirect(raw)).toBe(raw);
    },
  );

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash authority", "/\\evil.com"],
    ["absolute URL", "https://evil.com"],
    ["javascript URL", "javascript:alert(1)"],
    ["empty string", ""],
    ["leading space", " /user"],
    ["leading tab", "\t/user"],
    ["leading newline", "\n//evil.com"],
    ["embedded newline", "/\n/evil.com"],
    ["embedded tab", "/\t/evil.com"],
    ["relative path", "user"],
  ])("rejects a %s and returns the fallback", (_label, raw) => {
    expect(safeRedirect(raw)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("returns the fallback for null and undefined", () => {
    expect(safeRedirect(null)).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeRedirect(undefined)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("uses a custom fallback when one is given", () => {
    expect(safeRedirect("//evil.com", "/home")).toBe("/home");
  });
});
