/**
 * Component that deliberately crashes when rendered
 * Used for testing error boundaries and crash reporting
 */
export function CrashTester() {
  // Deliberately throw an error immediately when this component renders
  throw new Error('💥 Test crash: Intentional error to test error boundary and Sentry integration');
}
