/**
 * app.config.js - Expo configuration with env var injection
 * 
 * This file allows CI/CD to pass environment variables (like Supabase secrets)
 * which are embedded into the bundle via Constants.expoConfig.extra.
 * This ensures secrets reach the app even when process.env is not available at runtime.
 * 
 * Usage in CI:
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... npm run predeploy
 * 
 * The env vars will be merged into app.json extras and embedded in the build.
 */

export default ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      // Inject environment variables at build time if they exist
      // These will be available to app via Constants.expoConfig.extra
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL || config.extra?.supabaseUrl,
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || config.extra?.supabaseAnonKey,
      sentryDsn:
        process.env.EXPO_PUBLIC_SENTRY_DSN || config.extra?.sentryDsn,
    },
  };
};
