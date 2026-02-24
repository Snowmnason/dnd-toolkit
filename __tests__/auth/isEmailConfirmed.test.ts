import { isEmailConfirmed } from "@/lib/auth/auth-state";
import { describe, expect, it } from "vitest";

describe("isEmailConfirmed helper", () => {
  it("returns false for null session", () => {
    expect(isEmailConfirmed(null)).toBe(false);
  });

  it("returns true when session.user.email_confirmed_at is set", () => {
    const session = { user: { email_confirmed_at: "2024-01-01T00:00:00Z" } };
    expect(isEmailConfirmed(session)).toBe(true);
  });

  it("returns true when session.raw.user.confirmed_at is set", () => {
    const session = { raw: { user: { confirmed_at: "2024-01-01T00:00:00Z" } } };
    expect(isEmailConfirmed(session)).toBe(true);
  });

  it("returns false when no confirmed field present", () => {
    const session = { user: { id: "123", email: "a@b.com" } };
    expect(isEmailConfirmed(session)).toBe(false);
  });
});
