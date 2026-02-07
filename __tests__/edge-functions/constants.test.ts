/**
 * Edge Functions URL Tests
 *
 * Verifies that:
 * 1. Edge Function URLs are correct and match Supabase deployment
 * 2. URL builders produce correct full URLs
 * 3. Environment variable overrides work
 * 4. Health endpoint defaults to Edge Function (not /rest/v1/)
 */

import {
  EDGE_FUNCTIONS,
  getEdgeFunctionUrl,
  getHealthEndpointUrl,
} from "@/lib/edge-functions/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Edge Function URL Constants", () => {
  beforeEach(() => {
    // Save original env vars
    vi.stubEnv(
      "EXPO_PUBLIC_SUPABASE_URL",
      "https://xxoibawslmysvfllozyb.supabase.co",
    );
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("EDGE_FUNCTIONS constants", () => {
    it("should have health endpoint defined", () => {
      expect(EDGE_FUNCTIONS.HEALTH).toBe("/functions/v1/health");
    });

    it("should have get_feature_flags endpoint defined", () => {
      expect(EDGE_FUNCTIONS.GET_FEATURE_FLAGS).toBe(
        "/functions/v1/get_feature_flags",
      );
    });

    it("should have delete-account endpoint defined", () => {
      expect(EDGE_FUNCTIONS.DELETE_ACCOUNT).toBe(
        "/functions/v1/delete-account",
      );
    });

    it("should have invite-link-cleanup endpoint defined", () => {
      expect(EDGE_FUNCTIONS.INVITE_LINK_CLEANUP).toBe(
        "/functions/v1/invite-link-cleanup",
      );
    });

    it("should all start with /functions/v1/", () => {
      Object.values(EDGE_FUNCTIONS).forEach((path) => {
        expect(path).toMatch(/^\/functions\/v1\//);
      });
    });
  });

  describe("getEdgeFunctionUrl", () => {
    it("should build full health endpoint URL", () => {
      const url = getEdgeFunctionUrl(
        EDGE_FUNCTIONS.HEALTH,
        "https://xxoibawslmysvfllozyb.supabase.co",
      );
      expect(url).toBe(
        "https://xxoibawslmysvfllozyb.supabase.co/functions/v1/health",
      );
    });

    it("should build full get_feature_flags endpoint URL", () => {
      const url = getEdgeFunctionUrl(
        EDGE_FUNCTIONS.GET_FEATURE_FLAGS,
        "https://xxoibawslmysvfllozyb.supabase.co",
      );
      expect(url).toBe(
        "https://xxoibawslmysvfllozyb.supabase.co/functions/v1/get_feature_flags",
      );
    });

    it("should build full delete-account endpoint URL", () => {
      const url = getEdgeFunctionUrl(
        EDGE_FUNCTIONS.DELETE_ACCOUNT,
        "https://xxoibawslmysvfllozyb.supabase.co",
      );
      expect(url).toBe(
        "https://xxoibawslmysvfllozyb.supabase.co/functions/v1/delete-account",
      );
    });

    it("should build full invite-link-cleanup endpoint URL", () => {
      const url = getEdgeFunctionUrl(
        EDGE_FUNCTIONS.INVITE_LINK_CLEANUP,
        "https://xxoibawslmysvfllozyb.supabase.co",
      );
      expect(url).toBe(
        "https://xxoibawslmysvfllozyb.supabase.co/functions/v1/invite-link-cleanup",
      );
    });

    it("should strip trailing slashes from Supabase URL", () => {
      const url = getEdgeFunctionUrl(
        EDGE_FUNCTIONS.HEALTH,
        "https://xxoibawslmysvfllozyb.supabase.co/",
      );
      expect(url).toBe(
        "https://xxoibawslmysvfllozyb.supabase.co/functions/v1/health",
      );
    });

    it("should strip multiple trailing slashes", () => {
      const url = getEdgeFunctionUrl(
        EDGE_FUNCTIONS.HEALTH,
        "https://xxoibawslmysvfllozyb.supabase.co///",
      );
      expect(url).toBe(
        "https://xxoibawslmysvfllozyb.supabase.co/functions/v1/health",
      );
    });

    it("should throw if Supabase URL is missing", () => {
      expect(() => getEdgeFunctionUrl(EDGE_FUNCTIONS.HEALTH, "")).toThrow(
        "Supabase URL is required",
      );
    });

    it("should throw if Supabase URL is only whitespace", () => {
      expect(() => getEdgeFunctionUrl(EDGE_FUNCTIONS.HEALTH, "   ")).toThrow(
        "Supabase URL is required",
      );
    });
  });

  describe("getHealthEndpointUrl", () => {
    it("should return health Edge Function URL when using env vars", () => {
      vi.stubEnv(
        "EXPO_PUBLIC_SUPABASE_URL",
        "https://xxoibawslmysvfllozyb.supabase.co",
      );
      vi.stubEnv("EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT", "");

      const url = getHealthEndpointUrl();
      expect(url).toBe(
        "https://xxoibawslmysvfllozyb.supabase.co/functions/v1/health",
      );
    });

    it("should use explicit health endpoint override if set", () => {
      vi.stubEnv(
        "EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT",
        "https://custom.health/check",
      );

      const url = getHealthEndpointUrl();
      expect(url).toBe("https://custom.health/check");
    });

    it("should return empty string if no URL configured", () => {
      vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT", "");

      const url = getHealthEndpointUrl();
      expect(url).toBe("");
    });

    it("should return empty string if URL is undefined", () => {
      vi.unstubAllEnvs();
      const url = getHealthEndpointUrl();
      expect(url).toBe("");
    });

    it("should prefer explicit override over computed URL", () => {
      vi.stubEnv(
        "EXPO_PUBLIC_SUPABASE_URL",
        "https://xxoibawslmysvfllozyb.supabase.co",
      );
      vi.stubEnv(
        "EXPO_PUBLIC_SUPABASE_HEALTH_ENDPOINT",
        "https://override.io/health",
      );

      const url = getHealthEndpointUrl();
      expect(url).toBe("https://override.io/health");
    });
  });

  describe("URL Format Compliance", () => {
    it("all Edge Function URLs should be https URLs when combined with Supabase", () => {
      const supabaseUrl = "https://xxoibawslmysvfllozyb.supabase.co";
      Object.values(EDGE_FUNCTIONS).forEach((path) => {
        const full = getEdgeFunctionUrl(path, supabaseUrl);
        expect(full).toMatch(/^https:\/\//);
      });
    });

    it("all Edge Function URLs should not have double slashes in paths", () => {
      const supabaseUrl = "https://xxoibawslmysvfllozyb.supabase.co";
      Object.values(EDGE_FUNCTIONS).forEach((path) => {
        const full = getEdgeFunctionUrl(path, supabaseUrl);
        // Should not have // except in https://
        const pathPart = full.split("https://")[1];
        expect(pathPart).not.toContain("//");
      });
    });

    it("health endpoint should point to /functions/v1/health not /rest/v1/", () => {
      const url = getHealthEndpointUrl();
      expect(url).toContain("/functions/v1/health");
      expect(url).not.toContain("/rest/v1/");
    });
  });
});
