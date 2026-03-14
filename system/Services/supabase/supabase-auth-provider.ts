/**
 * Supabase Auth Provider Implementation
 *
 * Implements the AuthProvider interface by wrapping Supabase auth methods.
 * Handles error mapping from Supabase AuthError to normalized error types.
 * Manages session persistence via Supabase client.
 *
 * Usage:
 *   const provider = new SupabaseAuthProvider(supabaseClient);
 *   await registerAuthProvider(provider);
 */

import { logger } from '@/lib/utils/logger';
import { ERROR_CODES } from '@/maps/ERROR_CODES';
import {
    AuthError,
    AuthProvider,
    AuthResult,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    NetworkError,
    RateLimitError,
    Session,
    UserNotFoundError,
} from '@/system/Services/auth-adapter';
import { mapSupabaseAuthCode } from './supabase-error-translation';

/**
 * Supabase auth provider implementation.
 * Wraps @supabase/supabase-js auth API and maps errors to normalized types.
 */
export class SupabaseAuthProvider implements AuthProvider {
  private supabaseClient: any;

  /**
   * Create a new Supabase auth provider.
   *
   * @param supabaseClient - Initialized Supabase client instance
   */
  constructor(supabaseClient: any) {
    if (!supabaseClient) {
      throw new Error('SupabaseAuthProvider requires a Supabase client instance');
    }
    this.supabaseClient = supabaseClient;
  }

  /**
   * Sign up a new user with email and password.
   * Returns session on success or normalized error.
   * Note: Supabase may return user without session if email confirmation is required.
   */
  async signUp(email: string, password: string, options?: Record<string, any>): Promise<AuthResult> {
    try {
      logger.category('auth').debug('Supabase: signUp attempt');

      const { data, error } = await this.supabaseClient.auth.signUp({
        email,
        password,
        options,
      });

      if (error) {
        const normalized = this.mapSupabaseError(error);
        logger.category('auth').debug('Supabase signUp error:', normalized.toLog());
        return { success: false, error: normalized };
      }

      if (data?.user) {
        // Supabase may return user without session (e.g., email confirmation required)
        // Handle both cases: full session, or partial session with just userId
        let session: Session;
        if (data.session) {
          session = this.sessionFromSupabaseSession(data.session);
        } else {
          // No session yet (email confirmation pending); return partial session with userId only
          session = {
            userId: data.user.id,
          };
        }
        logger.category('auth').debug('Supabase signUp success', {
          userId: data.user.id,
          hasSession: !!data.session,
        });
        return { success: true, data: session };
      }

      // If neither error nor user, something unexpected happened
      const error_ = new AuthError('Sign up failed: unknown response');
      return { success: false, error: error_ };
    } catch (err) {
      const normalized = new AuthError(
        'Sign up failed',
        err,
        'SUPABASE_EXCEPTION'
      );
      logger.category('auth').error('Supabase signUp exception:', normalized.toLog());
      return { success: false, error: normalized };
    }
  }

  /**
   * Sign in an existing user with email and password.
   * Returns session on success or normalized error.
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      logger.category('auth').debug('Supabase: signIn attempt');

      const { data, error } = await this.supabaseClient.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

      if (error) {
        const normalized = this.mapSupabaseError(error);
        logger.category('auth').debug('Supabase signIn error:', normalized.toLog());
        return { success: false, error: normalized };
      }

      if (data?.user && data?.session) {
        const session = this.sessionFromSupabaseSession(data.session);
        logger.category('auth').info('Supabase signIn success', { userId: data.user.id });
        return { success: true, data: session };
      }

      const error_ = new AuthError('Sign in failed: unknown response');
      return { success: false, error: error_ };
    } catch (err) {
      const normalized = new AuthError(
        'Sign in failed',
        err,
        'SUPABASE_EXCEPTION'
      );
      logger.category('auth').error('Supabase signIn exception:', normalized.toLog());
      return { success: false, error: normalized };
    }
  }

  /**
   * Initiate OAuth sign-in flow.
   * Returns URL for browser redirect or session if native flow completed.
   */
  async signInWithOAuth(
    provider: string,
    options?: Record<string, any>
  ): Promise<{ url?: string; session?: Session }> {
    try {
      logger.category('auth').debug('Supabase: signInWithOAuth attempt', { provider });

      const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
        provider: provider as any,
        options: options || {},
      });

      if (error) {
        logger.category('auth').error('Supabase signInWithOAuth error:', error.message);
        throw new AuthError('OAuth sign-in failed', error);
      }

      if (data?.url) {
        logger.category('auth').debug('Supabase signInWithOAuth URL generated', { provider });
        return { url: data.url };
      }

      if (data?.session) {
        const session = this.sessionFromSupabaseSession(data.session);
        logger.category('auth').info('Supabase signInWithOAuth success', { provider });
        return { session };
      }

      throw new AuthError('OAuth sign-in failed: unknown response');
    } catch (err) {
      if (err instanceof AuthError) throw err;
      const normalized = new AuthError(
        'OAuth sign-in failed',
        err,
        'SUPABASE_EXCEPTION'
      );
      logger.category('auth').error('Supabase signInWithOAuth exception:', normalized.toLog());
      throw normalized;
    }
  }

  /**
   * Sign in using an ID token from native OAuth flow.
   * Used for Apple, Google, and other providers with ID token support.
   */
  async signInWithIdToken(
    provider: string,
    token: string,
    options?: Record<string, any>
  ): Promise<AuthResult> {
    try {
      logger.category('auth').debug('Supabase: signInWithIdToken attempt', { provider });

      const { data, error } = await this.supabaseClient.auth.signInWithIdToken({
        provider: provider as any,
        token,
        access_token: options?.access_token,
        nonce: options?.nonce,
      });

      if (error) {
        const normalized = this.mapSupabaseError(error);
        logger.category('auth').debug('Supabase signInWithIdToken error:', normalized.toLog());
        return { success: false, error: normalized };
      }

      if (data?.user && data?.session) {
        const session = this.sessionFromSupabaseSession(data.session);
        logger.category('auth').info('Supabase signInWithIdToken success', {
          provider,
          userId: data.user.id,
        });
        return { success: true, data: session };
      }

      const error_ = new AuthError('ID token sign-in failed: unknown response');
      return { success: false, error: error_ };
    } catch (err) {
      const normalized = new AuthError(
        'ID token sign-in failed',
        err,
        'SUPABASE_EXCEPTION'
      );
      logger.category('auth').error('Supabase signInWithIdToken exception:', normalized.toLog());
      return { success: false, error: normalized };
    }
  }

  /**
   * Initiate password reset flow.
   * Supabase sends reset email to user.
   * Redirect URL must match an existing route handler (/login/auth-redirect)
   */
  async resetPassword(email: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      logger.category('auth').debug('Supabase: resetPassword attempt');

      const baseUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : 'https://dnd-tool.thesnowpost.com';

      const { error } = await this.supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${baseUrl}/login/auth-redirect?action=reset-password`,
        }
      );

      if (error) {
        logger.category('auth').warn('Supabase resetPassword error:', error.message);
        return {
          success: false,
          message: 'Failed to send reset email. Please try again.',
        };
      }

      return {
        success: true,
        message: 'Reset email sent. Check your inbox.',
      };
    } catch (err) {
      logger.category('auth').error('Supabase resetPassword exception:', err);
      return {
        success: false,
        message: 'An error occurred. Please try again.',
      };
    }
  }

  /**
   * Resend a confirmation email (for signup confirmation or email verification).
   * Calls Supabase's resend() method to re-queue the confirmation email.
   */
  async resend(email: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      logger.category('auth').debug('Supabase: resend attempt');

      const { error } = await this.supabaseClient.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        logger.category('auth').warn('Supabase resend error:', error.message);
        return {
          success: false,
          message: 'Failed to resend confirmation email. Please try again.',
        };
      }

      logger.category('auth').info('Supabase resend success');
      return {
        success: true,
        message: 'Confirmation email sent. Check your inbox.',
      };
    } catch (err) {
      logger.category('auth').error('Supabase resend exception:', err);
      return {
        success: false,
        message: 'An error occurred. Please try again.',
      };
    }
  }

  /**
   * Update the authenticated user's password.
   * Requires active session (typically from password reset token).
   */
  async updatePassword(newPassword: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      logger.category('auth').debug('Supabase: updatePassword attempt');

      const { error } = await this.supabaseClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        logger.category('auth').warn('Supabase updatePassword error:', error.message);
        
        if (error.message.includes('Password')) {
          return {
            success: false,
            error: 'Password does not meet requirements. Please ensure it is at least 6 characters long.',
          };
        }

        return {
          success: false,
          error: error.message || 'Failed to update password. Please try again.',
        };
      }

      logger.category('auth').info('Supabase updatePassword success');
      return { success: true };
    } catch (err) {
      logger.category('auth').error('Supabase updatePassword exception:', err);
      return {
        success: false,
        error: 'An error occurred while updating password. Please try again.',
      };
    }
  }

  /**
   * Get current session (if authenticated).
   * Returns null if no active session.
   * Returns from Supabase's local cache — no network call.
   */
  async getSession(): Promise<Session | null> {
    try {
      const { data, error } = await this.supabaseClient.auth.getSession();

      if (error) {
        logger.category('auth').warn('Supabase getSession error:', error.message);
        return null;
      }

      if (data?.session) {
        return this.sessionFromSupabaseSession(data.session);
      }

      return null;
    } catch (err) {
      logger.category('auth').error('Supabase getSession exception:', err);
      return null;
    }
  }

  /**
   * Validate the current user with the server (live network call).
   * Uses supabase.auth.getUser() which verifies the JWT server-side.
   * Returns null if token is expired, revoked, or invalid.
   */
  async getUser(): Promise<Session | null> {
    try {
      const { data, error } = await this.supabaseClient.auth.getUser();

      if (error) {
        logger.category('auth').warn('Supabase getUser error:', error.message);
        return null;
      }

      if (data?.user) {
        return {
          userId: data.user.id,
          email: data.user.email,
          raw: { user: data.user },
        };
      }

      return null;
    } catch (err) {
      logger.category('auth').error('Supabase getUser exception:', err);
      return null;
    }
  }

  /**
   * Subscribe to auth state changes.
   * Wraps Supabase onAuthStateChange and normalizes callback.
   */
  onAuthStateChange(
    callback: (session: Session | null) => void
  ): () => void {
    const { data } = this.supabaseClient.auth.onAuthStateChange(
      (_event: string, supbaseSession: any) => {
        const session = supbaseSession
          ? this.sessionFromSupabaseSession(supbaseSession)
          : null;
        callback(session);
      }
    );

    // Return unsubscribe function
    return () => {
      data?.subscription?.unsubscribe?.();
    };
  }

  /**
   * Sign out the current user.
   * Clears session and tokens in Supabase.
   */
  async signOut(): Promise<void> {
    try {
      logger.category('auth').debug('Supabase: signOut');

      const { error } = await this.supabaseClient.auth.signOut();

      if (error) {
        logger.category('auth').warn('Supabase signOut error:', error.message);
        // Don't throw; sign out partially succeeded
        return;
      }

      logger.category('auth').info('Supabase signOut success');
    } catch (err) {
      logger.category('auth').error('Supabase signOut exception:', err);
      // Don't throw on logout errors
    }
  }

  /**
   * Restore a previously saved session during app bootstrap.
   * Sets the session on the Supabase client.
   *
   * @param rawSession - The raw session object (access token, refresh token, etc.)
   * @returns true if restore was successful, false if expired/invalid
   */
  async restoreSession(rawSession: any): Promise<boolean> {
    try {
      if (!rawSession) {
        logger.category('auth').debug('Supabase: restoreSession skipped (no session data)');
        return false;
      }

      logger.category('auth').info('Supabase: restoring session from storage', {
        userId: rawSession.user?.id,
      });

      const { error } = await this.supabaseClient.auth.setSession({
        access_token: rawSession.access_token,
        refresh_token: rawSession.refresh_token,
        expires_at: rawSession.expires_at,
        expires_in: rawSession.expires_in,
        token_type: rawSession.token_type,
        user: rawSession.user,
      });

      if (error) {
        logger.category('auth').warn('Supabase: failed to restore session', { error: error.message });
        return false; // Session is invalid/expired
      }

      logger.category('auth').info('Supabase: session restored successfully', {
        userId: rawSession.user?.id,
      });
      return true;
    } catch (err) {
      logger.category('auth').error('Supabase: exception during session restore:', err);
      return false;
    }
  }

  /**
   * Refresh the current session's tokens.
   * Uses Supabase's built-in refresh token mechanism (JWT refresh).
   * Returns updated session or null if refresh fails.
   */
  async refreshSession(): Promise<Session | null> {
    try {
      logger.category('auth').debug('Supabase: refreshSession attempt');

      const { data, error } = await this.supabaseClient.auth.refreshSession();

      if (error || !data.session) {
        logger.category('auth').warn('Supabase refreshSession failed', {
          error: error?.message || 'No session after refresh',
        });
        return null;
      }

      logger.category('auth').info('Supabase refreshSession success', {
        userId: data.session.user?.id,
      });
      return this.sessionFromSupabaseSession(data.session);
    } catch (err) {
      logger.category('auth').error('Supabase refreshSession exception:', err);
      return null;
    }
  }

  /**
   * Convert Supabase session to normalized Session type.
   */
  private sessionFromSupabaseSession(supabaseSession: any): Session {
    return {
      userId: supabaseSession.user?.id || '',
      email: supabaseSession.user?.email,
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: supabaseSession.expires_at
        ? supabaseSession.expires_at * 1000
        : undefined,
      raw: supabaseSession, // Keep original for provider-specific access
    };
  }

  /**
   * Map Supabase AuthError to normalized error types.
   * Preserves original error on `.original` field for debugging.
   *
   * **Error Mapping Strategy:**
   * 1. Check error code (most reliable)
   * 2. Check error message patterns (case-insensitive)
   * 3. Check exception type (network errors)
   * 4. Default to generic AuthError
   *
   * **User-Facing Messages:**
   * Network/timeout errors → suggest checking connection
   * Invalid credentials → suggest retry with correct details
   * Email exists → suggest sign in instead
   * Other errors → generic "try again" message
   */
  private mapSupabaseError(supabaseError: any): AuthError {
    const message = supabaseError?.message || 'Unknown auth error';
    const code = supabaseError?.code || supabaseError?.status;
    const messageLower = message.toLowerCase();

    logger.category('auth').debug('Mapping Supabase error:', {
      code,
      message,
      type: supabaseError?.constructor?.name,
    });

    // Invalid credentials
    if (
      messageLower.includes('invalid login credentials') ||
      messageLower.includes('invalid credentials') ||
      messageLower.includes('invalid email or password') ||
      messageLower.includes('incorrect password') ||
      code === 'invalid_credentials'
    ) {
      return new InvalidCredentialsError(message, supabaseError);
    }

    // Email already exists (signup conflicts)
    if (
      messageLower.includes('user already registered') ||
      messageLower.includes('already registered') ||
      messageLower.includes('already been registered') ||
      messageLower.includes('email address not available') ||
      messageLower.includes('duplicate key value') ||
      messageLower.includes('duplicate email') ||
      messageLower.includes('unique constraint') ||
      code === '23505' || // Postgres unique constraint error
      code === 'user_already_exists'
    ) {
      return new EmailAlreadyExistsError(message, supabaseError);
    }

    // User not found (signin/reset password target)
    if (
      messageLower.includes('user not found') ||
      messageLower.includes('no user found') ||
      messageLower.includes('user does not exist') ||
      code === 'user_not_found'
    ) {
      return new UserNotFoundError(message, supabaseError);
    }

    // Rate limit exceeded (too many attempts)
    if (
      code === 429 ||
      code === 'RATE_LIMIT' ||
      messageLower.includes('too many') ||
      messageLower.includes('rate limit') ||
      messageLower.includes('throttle')
    ) {
      // Try to extract retry-after seconds from message (pattern: "123 seconds" or "123s")
      const retryAfterMatch = messageLower.match(/(\d+)/);
      const retryAfterSeconds = retryAfterMatch?.[1] ? parseInt(retryAfterMatch[1], 10) : undefined;
      return new RateLimitError(message, supabaseError, retryAfterSeconds);
    }

    // Network errors and timeouts
    if (
      messageLower.includes('request timeout') ||
      messageLower.includes('network') ||
      messageLower.includes('fetch failed') ||
      messageLower.includes('econnrefused') ||
      messageLower.includes('enotfound') ||
      messageLower.includes('time out') ||
      supabaseError instanceof TypeError ||
      code === ERROR_CODES.NETWORK.RAW.NETWORK_ERROR ||
      code === ERROR_CODES.NETWORK.RAW.ETIMEDOUT
    ) {
      return new NetworkError(message, supabaseError);
    }

    // Email verification or signup flow errors
    if (
      messageLower.includes('email verification') ||
      messageLower.includes('confirm your email') ||
      messageLower.includes('please confirm') ||
      messageLower.includes('unverified email')
    ) {
      return new AuthError(
        message,
        supabaseError,
        ERROR_CODES.AUTH.EMAIL_NOT_CONFIRMED,
        'Please verify your email address before signing in.'
      );
    }

    // Password requirements not met
    if (
      messageLower.includes('password too short') ||
      messageLower.includes('password length') ||
      messageLower.includes('password must') ||
      code === 'password_too_short'
    ) {
      return new InvalidCredentialsError(
        message,
        supabaseError,
        'Your password does not meet security requirements. Please use a stronger password.'
      );
    }

    // Default: generic auth error — translate raw Supabase code to canonical AUTH code
    return new AuthError(
      message,
      supabaseError,
      mapSupabaseAuthCode(code),
      'An authentication error occurred. Please try again.'
    );
  }
}
