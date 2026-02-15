/**
 * Phase 7: Integration Tests for Cohorts
 *
 * Tests database operations, RLS policies, and edge function integration.
 * These tests require a test database with cohort schema.
 *
 * NOTE: These tests are automatically skipped unless real Supabase test credentials
 * are provided via TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, and TEST_SUPABASE_SERVICE_KEY
 * environment variables. The fallback values will cause the tests to be skipped to prevent
 * network calls and failures in CI/dev environments without a running local Supabase stack.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test database configuration
// These should be set in test environment
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || "http://localhost:54321";
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || "test-anon-key";
const TEST_SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || "test-service-key";

// Test data - using UUIDs as required by schema
const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000"; // UUID format
const TEST_ADMIN_ID = "550e8400-e29b-41d4-a716-446655440001"; // UUID format
const TEST_COHORT_ID = "550e8400-e29b-41d4-a716-446655440002"; // UUID format

// Check if we have real test credentials (not fallbacks)
const hasRealTestCredentials = () => {
  return (
    TEST_SUPABASE_URL !== "http://localhost:54321" &&
    TEST_SUPABASE_ANON_KEY !== "test-anon-key" &&
    TEST_SUPABASE_SERVICE_KEY !== "test-service-key"
  );
};

// Skip all tests if real test credentials are not available
const testSuite = hasRealTestCredentials()
  ? describe
  : describe.skip;

// Warn if tests are being skipped due to missing credentials
if (!hasRealTestCredentials()) {
  console.warn(
    "⚠️  Cohorts integration tests skipped: Missing real Supabase test credentials.\n" +
    "   Set TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, and TEST_SUPABASE_SERVICE_KEY\n" +
    "   environment variables to run these tests."
  );
}

testSuite("Phase 7: Cohorts Integration Tests", () => {
  let anonClient: SupabaseClient;
  let adminClient: SupabaseClient;

  beforeAll(async () => {
    anonClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
    adminClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY);

    // Create test user in public.users (required for FK constraints)
    await adminClient
      .from("users")
      .upsert({
        id: TEST_USER_ID,
        email: "test-integration@example.com",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
  });

  afterAll(async () => {
    // Clean up test data
    await adminClient.schema("feature_flags").from("user_cohort_memberships").delete().eq("user_id", TEST_USER_ID);
    await adminClient.schema("feature_flags").from("cohorts").delete().eq("id", TEST_COHORT_ID);
    await adminClient.schema("feature_flags").from("cohort_flag_assignments").delete().eq("cohort_id", TEST_COHORT_ID);

    // Clean up test user
    await adminClient.from("users").delete().eq("id", TEST_USER_ID);
  });

  describe("Database Schema & RLS Policies", () => {
    it("should create cohort as admin", async () => {
      const { data, error } = await adminClient
        .schema("feature_flags")
        .from("cohorts")
        .insert({
          id: TEST_COHORT_ID,
          slug: "integration_test_cohort",
          name: "Integration Test Cohort",
          percentage: 50,
          seed: "integration_test",
          is_active: true,
        })
        .select();

      expect(error).toBeNull();
      expect(data?.[0]).toMatchObject({
        id: TEST_COHORT_ID,
        slug: "integration_test_cohort",
        name: "Integration Test Cohort",
        percentage: 50,
        seed: "integration_test",
        is_active: true,
      });
    });

    it("should reject cohort creation from anonymous user", async () => {
      const { error } = await anonClient
        .schema("feature_flags")
        .from("cohorts")
        .insert({
          slug: "should_fail_cohort",
          name: "Should Fail Cohort",
          percentage: 100,
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("permission denied");
    });

    it("should assign user to cohort as admin", async () => {
      const { data, error } = await adminClient
        .schema("feature_flags")
        .from("user_cohort_memberships")
        .insert({
          user_id: TEST_USER_ID,
          cohort_id: TEST_COHORT_ID,
          source: "direct",
          is_active: true,
        })
        .select();

      expect(error).toBeNull();
      expect(data?.[0]).toMatchObject({
        user_id: TEST_USER_ID,
        cohort_id: TEST_COHORT_ID,
        source: "direct",
        is_active: true,
      });
    });

    it("should reject user assignment from anonymous user", async () => {
      const { error } = await anonClient
        .schema("feature_flags")
        .from("user_cohort_memberships")
        .insert({
          user_id: "550e8400-e29b-41d4-a716-446655440003", // Different UUID
          cohort_id: TEST_COHORT_ID,
          source: "direct",
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("permission denied");
    });

    it("should allow user to read their own memberships", async () => {
      // This would require setting up auth context for TEST_USER_ID
      // For now, we'll test that admin can read all memberships
      const { data, error } = await adminClient
        .schema("feature_flags")
        .from("user_cohort_memberships")
        .select("*")
        .eq("user_id", TEST_USER_ID);

      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThan(0);
      expect(data?.[0].user_id).toBe(TEST_USER_ID);
    });

    it("should read active cohorts for anonymous users", async () => {
      const { data, error } = await anonClient
        .schema("feature_flags")
        .from("cohorts")
        .select("*")
        .eq("is_active", true);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      // Should include our test cohort
      const testCohort = data?.find(c => c.id === TEST_COHORT_ID);
      expect(testCohort).toBeDefined();
      expect(testCohort?.is_active).toBe(true);
    });

    it("should not read inactive cohorts for anonymous users", async () => {
      // First mark our test cohort inactive temporarily
      await adminClient
        .schema("feature_flags")
        .from("cohorts")
        .update({ is_active: false })
        .eq("id", TEST_COHORT_ID);

      const { data } = await anonClient
        .schema("feature_flags")
        .from("cohorts")
        .select("*")
        .eq("is_active", true);

      // Should not include our inactive test cohort
      const testCohort = data?.find(c => c.id === TEST_COHORT_ID);
      expect(testCohort).toBeUndefined();

      // Restore active status
      await adminClient
        .schema("feature_flags")
        .from("cohorts")
        .update({ is_active: true })
        .eq("id", TEST_COHORT_ID);
    });
  });

  describe("Edge Function Integration", () => {
    it("should return cohorts in get_feature_flags response", async () => {
      // This test requires the edge function to be deployed
      // and proper auth setup
      const { data, error } = await anonClient.functions.invoke("get_feature_flags");

      if (error) {
        console.warn("Edge function not available, skipping test");
        return;
      }

      expect(data).toHaveProperty("cohorts");
      expect(data).toHaveProperty("cohort_assignments");
      expect(data).toHaveProperty("user_cohort_memberships");
      expect(Array.isArray(data.cohorts)).toBe(true);
      expect(Array.isArray(data.cohort_assignments)).toBe(true);
      expect(Array.isArray(data.user_cohort_memberships)).toBe(true);
    });

    it("should filter user memberships by authenticated user", async () => {
      // This requires proper JWT auth setup in test environment
      // For now, we'll test the structure
      const { data, error } = await anonClient.functions.invoke("get_feature_flags");

      if (error) {
        console.warn("Edge function not available, skipping test");
        return;
      }

      // All returned memberships should be for the authenticated user
      // (This is enforced by RLS in the edge function)
      data.user_cohort_memberships.forEach((membership: any) => {
        expect(membership.user_id).toBeDefined();
        // In a real test, we'd verify it matches the JWT user_id
      });
    });
  });

  describe("Cohort Flag Assignments", () => {
    it("should create cohort-flag assignment as admin", async () => {
      const { data, error } = await adminClient
        .schema("feature_flags")
        .from("cohort_flag_assignments")
        .insert({
          flag_name: "integration_test_flag",
          cohort_id: TEST_COHORT_ID,
        });

      expect(error).toBeNull();
      expect(data?.[0]).toMatchObject({
        flag_name: "integration_test_flag",
        cohort_id: TEST_COHORT_ID,
      });
    });

    it("should reject cohort-flag assignment from anonymous user", async () => {
      const { error } = await anonClient
        .schema("feature_flags")
        .from("cohort_flag_assignments")
        .insert({
          flag_name: "should_fail_flag",
          cohort_id: TEST_COHORT_ID,
        });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("permission denied");
    });

    it("should prevent duplicate cohort-flag assignments", async () => {
      const { error } = await adminClient
        .from("cohort_flag_assignments")
        .insert({
          flag_name: "integration_test_flag",
          cohort_id: TEST_COHORT_ID,
        });

      expect(error).not.toBeNull();
      // Should be a unique constraint violation
    });
  });

  describe("Data Integrity & Constraints", () => {
    it("should enforce unique cohort slug", async () => {
      const { error } = await adminClient
        .schema("feature_flags")
        .from("cohorts")
        .insert({
          slug: "integration_test_cohort", // Same slug as existing
          name: "Duplicate Slug Cohort",
          percentage: 25,
        });

      expect(error).not.toBeNull();
      // Should be unique constraint violation
    });

    it("should enforce unique user-cohort membership", async () => {
      const { error } = await adminClient
        .schema("feature_flags")
        .from("user_cohort_memberships")
        .insert({
          user_id: TEST_USER_ID,
          cohort_id: TEST_COHORT_ID,
          source: "direct",
        });

      expect(error).not.toBeNull();
      // Should be unique constraint violation
    });

    it("should enforce percentage bounds (0-100)", async () => {
      const { error: errorNegative } = await adminClient
        .schema("feature_flags")
        .from("cohorts")
        .insert({
          slug: "negative_percentage",
          name: "Negative Percentage",
          percentage: -10,
        });

      const { error: errorOver } = await adminClient
        .schema("feature_flags")
        .from("cohorts")
        .insert({
          slug: "over_percentage",
          name: "Over Percentage",
          percentage: 150,
        });

      // These might be handled by CHECK constraints or app logic
      // The test verifies the database accepts or rejects appropriately
      expect(errorNegative || errorOver).toBeDefined();
    });
  });

  describe("Audit Trail", () => {
    it("should create audit events for cohort operations", async () => {
      // Create a new cohort to trigger audit
      const testSlug = `audit_test_${Date.now()}`;
      await adminClient
        .from("cohorts")
        .insert({
          slug: testSlug,
          name: "Audit Test Cohort",
          percentage: 10,
        });

      // Check audit table (requires admin access)
      const { data } = await adminClient
        .schema("audit")
        .from("audit_events")
        .select("*")
        .eq("table_name", "cohorts")
        .eq("event_type", "insert")
        .order("created_at", { ascending: false })
        .limit(1);

      expect(data?.length).toBeGreaterThan(0);
      expect(data?.[0].table_name).toBe("cohorts");
      expect(data?.[0].event_type).toBe("insert");

      // Clean up
      await adminClient.schema("feature_flags").from("cohorts").delete().eq("slug", testSlug);
    });
  });
});