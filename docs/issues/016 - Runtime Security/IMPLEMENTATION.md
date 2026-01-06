# Runtime Security Hardening - Implementation Summary

## Overview
This document summarizes the comprehensive security hardening measures implemented for the DnD Toolkit application, addressing both web and desktop platforms while maintaining the collaborative nature of the app.

## Implemented Security Measures

### 1. Web Security Enhancements

#### Content Security Policy (CSP) with Nonce-Based Script Loading
- **Script**: `scripts/harden-web.js` - automatically generates a unique nonce per build
- **Implementation**: 
  - Nonce injected into all `<script>` and `<style>` tags in compiled HTML
  - CSP meta tag inserted with nonce-aware directives
  - Strict CSP without `unsafe-inline` or `unsafe-eval`
  - Allows trusted origins: self, Supabase, Sentry, Google Fonts
- **Integration**: Runs automatically via `npm run predeploy` and `npm run predeploy:desktop`

#### Subresource Integrity (SRI)
- **Implementation**: `scripts/harden-web.js` computes SHA-384 hashes for bundled scripts
- **Benefits**: Prevents execution of tampered assets
- **Scope**: Local scripts only (external CDNs trusted via CSP)

#### Security Headers (via `_headers` file)
- **HSTS**: `max-age=63072000; includeSubDomains; preload` (2 years)
- **CORS**: Restricted to production domain `https://dnd-tool.thesnowpost.com`
- **Cross-Origin Policies**: 
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
- **Additional Headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

#### Cache Control
- HTML: `max-age=300` (5 minutes) - allows rapid updates
- JS/CSS/Assets: `max-age=31536000, immutable` (1 year) - long-lived static assets

### 2. Electron Desktop Security

#### Enhanced Window Security
- **Context Isolation**: Enabled
- **Node Integration**: Disabled (nodeIntegration, nodeIntegrationInWorker, nodeIntegrationInSubFrames)
- **Remote Module**: Disabled
- **WebView**: Blocked via `webviewTag: false` and will-attach-webview prevention
- **Insecure Content**: Blocked via `allowRunningInsecureContent: false`
- **Safe Dialogs**: Enabled
- **Navigation Drag-Drop**: Disabled

#### IPC Security
- **Trusted Origins**: Only `app://`, `file://`, and `http://localhost:8081` (dev) allowed
- **Origin Validation**: `isTrustedSender()` guards all IPC handlers
- **Input Sanitization**: All text inputs sanitized and length-limited
- **Handlers Registered**:
  - `get-app-version`, `get-system-theme`
  - `window-minimize`, `window-maximize`, `window-close`
  - `show-open-dialog`, `show-save-dialog` (sanitized options)
  - `show-notification` (sanitized title/body)

#### Session Security
- **Permissions**: All permission requests denied by default
- **CSP Injection**: Session-level CSP headers for app:// and file:// resources
- **CORP/COOP/COEP**: Cross-origin isolation enforced at session level

#### Navigation Guards
- **will-navigate**: Blocks navigation outside app://, file://, and localhost (dev)
- **setWindowOpenHandler**: Only HTTPS links (or localhost in dev) opened externally; all else denied
- **Webview Blocking**: Prevents embedding webviews

### 3. Authentication Security

#### Client-Side Rate Limiting & Account Lockout
- **Module**: `lib/auth/auth-attempt-guard.ts`
- **Scope**: per-email, per-action (signin, signup, reset)
- **Limits**: 
  - Max 5 attempts per 10-minute window
  - 15-minute lockout after 5 failed attempts
- **Storage**: Encrypted on native, localStorage on web
- **Monitoring**: Sentry alerts on lockout events with email domain logging

#### Request Deduplication & Server Rate Limiting
- **Module**: `lib/api/request-manager.ts` (existing)
- **Integration**: All auth operations (signUp, signIn, passwordReset) wrapped with RequestManager
- **Benefits**:
  - Deduplicates concurrent identical requests
  - Token bucket rate limiting (10 req/sec, burst to 20)
  - Retry with exponential backoff
  - Fail-open option for graceful degradation
  - Automatic Sentry error reporting

#### Secure Token Storage
- **Web**: 
  - Default: **sessionStorage** (not persisted across browser sessions)
  - Fallback: localStorage (if sessionStorage unavailable)
  - Configurable via `EXPO_PUBLIC_AUTH_STORAGE_MODE` env var
- **Native**: Encrypted storage via expo-secure-store (iOS Keychain, Android Keystore)
- **Supabase Auth**:
  - PKCE flow enforced
  - Secure cookies: `sameSite: lax`, `secure: true`, 7-day lifetime
  - Auto token refresh enabled

#### Input Validation & Sanitization
- **Email**: Normalized (trim, lowercase), validated with regex
- **Password**: Strength requirements enforced, no raw storage client-side
- **All Auth Inputs**: Validated before any network call

### 4. Data Protection

#### Encryption at Rest
- **Native**: All sensitive data encrypted via `lib/auth/encrypted-storage.ts`
  - iOS: Keychain
  - Android: Keystore
  - 256-bit AES-CTR encryption
- **Web**: Browser storage (sessionStorage default, localStorage fallback)

#### Supabase Security
- **RLS**: Row-level security policies enforced server-side (existing)
- **HTTPS Only**: All connections over TLS
- **Connection Pooling**: Managed by Supabase SDK
- **Auth Tokens**: Short-lived JWT with automatic refresh

### 5. Monitoring & Logging

#### Sentry Integration (Existing)
- **Error Tracking**: All auth failures, request errors, critical path failures
- **Context Enrichment**: 
  - Request manager adds request context (key, options, rate limit status)
  - Auth lockouts tagged with email domain and attempt details
- **Environment Awareness**: Development errors filtered, production sampled at 10%
- **PII Handling**: Email domains logged, not full emails

#### Security Event Logging
- **Auth Attempts**: All signin/signup/reset attempts tracked
- **Lockouts**: Logged to Sentry with warning level
- **IPC Violations**: Blocked untrusted IPC calls logged to console
- **Navigation Blocks**: Prevented navigations logged in Electron

## Security Considerations for Collaborative Use

### What We Protected
- **Injection Attacks**: CSP prevents XSS, nonce-based scripts block inline injection
- **Session Hijacking**: Secure cookies, sessionStorage default, encrypted native storage
- **Brute Force**: Client-side rate limiting + lockouts, server-side deduplication
- **MITM**: HSTS enforces HTTPS, Supabase uses TLS
- **Unauthorized Access**: Auth guards on routes, session validation

### What We Preserved
- **World Sharing**: Invite links still work, no impact on collaboration
- **Multi-Device**: Sessions can be used on multiple devices (within reason)
- **Offline Grace**: Fail-open patterns allow offline use where appropriate
- **Performance**: Rate limiting allows bursts, deduplication reduces unnecessary calls

## Testing & Validation

### Recommended Tests
1. **Web**: Check CSP compliance at [securityheaders.com](https://securityheaders.com)
2. **Electron**: Verify IPC handlers reject untrusted origins
3. **Auth**: Test lockout after 5 failed logins
4. **Rate Limiting**: Verify burst handling and token bucket refill

### Known Trade-offs
- **SessionStorage Default**: Users need to re-login per browser session on web (can override via env var)
- **Client-Side Lockout**: Sophisticated attackers can bypass (but server-side Supabase rate limits still apply)
- **Sentry Dependency**: Security monitoring relies on Sentry availability

## Environment Variables

### Optional Security Overrides
- `EXPO_PUBLIC_AUTH_STORAGE_MODE`: `'session'` (default) or `'local'` - controls web auth persistence
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Required for auth to function

## Maintenance

### Future Improvements (From Issue)
- [ ] Server-side rate limiting (currently client-side + RequestManager)
- [ ] CSP violation reporting endpoint
- [ ] Automated security scanning in CI/CD
- [ ] Audit logs for sensitive operations (world deletion, role changes)

### Regular Tasks
- Review Sentry alerts for lockout patterns
- Monitor CSP violations (if reporting enabled)
- Audit dependencies for known vulnerabilities (`npm audit`)
- Update security headers as needed

## References
- [CSP Configuration](../CSP-Configuration.md)
- [Request Manager](../../lib/api/request-manager.ts)
- [Auth Attempt Guard](../../lib/auth/auth-attempt-guard.ts)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
