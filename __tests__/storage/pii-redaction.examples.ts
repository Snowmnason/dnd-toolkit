/**
 * PII Redaction Patterns Test
 *
 * Demonstrates all pattern types and their effectiveness at catching PII.
 * Run manually to verify redaction works for various input formats.
 */

import {
  containsPII,
  PREFIXED_PII_PATTERNS,
  redactPII,
  STANDALONE_PII_PATTERNS,
} from "@/lib/utils/pii-redaction";

/**
 * Test suite for PII redaction patterns.
 * Run in browser console or test runner.
 */
export function testPIIRedaction() {
  const testCases = [
    // ============ PREFIXED PATTERNS ============
    {
      name: "Prefixed email field",
      input: 'email: "user@example.com"',
      shouldRedact: true,
    },
    {
      name: "Prefixed JWT token",
      input:
        "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ",
      shouldRedact: true,
    },
    {
      name: "Prefixed session ID",
      input: 'session: "sess_12345abcde_xyz789"',
      shouldRedact: true,
    },
    {
      name: "Prefixed userid",
      input: "userid=123e4567-e89b-12d3-a456-426614174000",
      shouldRedact: true,
    },
    {
      name: "Prefixed UUID with id field",
      input: 'id: "8f5a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c"',
      shouldRedact: true,
    },
    {
      name: "Prefixed API key",
      input: 'apikey: "test_key_abc123def456ghi789"',
      shouldRedact: true,
    },
    {
      name: "Prefixed phone number",
      input: "phone: +1-555-123-4567",
      shouldRedact: true,
    },
    {
      name: "URL with email param",
      input: "https://example.com?email=user@domain.com&confirmed=true",
      shouldRedact: true,
    },
    {
      name: "URL with token param",
      input: "https://example.com/reset?token=reset_token_abc123xyz",
      shouldRedact: true,
    },

    // ============ STANDALONE PATTERNS ============
    {
      name: "Standalone email (bare)",
      input: "user@example.com",
      shouldRedact: true,
    },
    {
      name: "Email in error message",
      input: "Failed to send email to admin@company.com during signup",
      shouldRedact: true,
    },
    {
      name: "JWT in error message",
      input:
        "Invalid token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
      shouldRedact: true,
    },
    {
      name: "Standalone UUID",
      input: "Could not find user 8f5a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
      shouldRedact: true,
    },
    {
      name: "API key (32+ chars)",
      input: "Used API key: test_key_production_1234567890abcdefghijklmnopqrst",
      shouldRedact: true,
    },

    // ============ EDGE CASES ============
    {
      name: "Non-email address (should not redact with standalone=false)",
      input: "example.com",
      shouldRedact: false,
    },
    {
      name: "Plain text (no PII)",
      input: "This is just regular text",
      shouldRedact: false,
    },
    {
      name: "Email-like but invalid",
      input: "invalid@",
      shouldRedact: false,
    },
    {
      name: "UUID-like but incomplete",
      input: "8f5a1b2c-3d4e-5f6a-7b8c",
      shouldRedact: false,
    },
  ];

  console.group("🔐 PII Redaction Pattern Tests");

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const redacted = redactPII(testCase.input);
    const hasPII = containsPII(testCase.input);
    const didRedact = redacted !== testCase.input;
    const success =
      didRedact === testCase.shouldRedact && hasPII === testCase.shouldRedact;

    if (success) {
      console.log(`✅ ${testCase.name}`);
      passed++;
    } else {
      console.error(`❌ ${testCase.name}`);
      console.error(`   Input: ${testCase.input}`);
      console.error(`   Output: ${redacted}`);
      console.error(
        `   Expected redaction: ${testCase.shouldRedact}, Got: ${didRedact}`,
      );
      failed++;
    }
  }

  console.groupEnd();
  console.log(
    `\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length}`,
  );

  return { passed, failed, total: testCases.length };
}

/**
 * Pattern coverage report - shows which patterns are active.
 */
export function showPatternCoverage() {
  console.group("🎯 PII Pattern Coverage");

  console.log("Prefixed Patterns (Field-based redaction):");
  PREFIXED_PII_PATTERNS.forEach((pattern, index) => {
    console.log(`  [${index + 1}] ${pattern}`);
  });

  console.log("\nStandalone Patterns (Value-based redaction):");
  STANDALONE_PII_PATTERNS.forEach((pattern, index) => {
    console.log(`  [${index + 1}] ${pattern}`);
  });

  console.log(
    `\nTotal patterns: ${PREFIXED_PII_PATTERNS.length + STANDALONE_PII_PATTERNS.length}`,
  );
  console.groupEnd();
}

// Run tests if called directly
if (typeof window !== "undefined") {
  // @ts-expect-error - For manual testing in browser console
  window.testPIIRedaction = testPIIRedaction;
  // @ts-expect-error - For manual testing in browser console
  window.showPatternCoverage = showPatternCoverage;
}
