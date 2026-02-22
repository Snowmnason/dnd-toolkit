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
} from '@/lib/services/auth-provider';
import { logger } from '@/lib/utils/logger';

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
    logger.debug('auth', 'SupabaseAuthProvider initialized');
  }

  /**
   * Sign up a new user with email and password.
   * Returns session on success or normalized error.
   * Note: Supabase may return user without session if email confirmation is required.
   */
  async signUp(email: string, password: string, options?: Record<string, any>): Promise<AuthResult> {
    try {
      logger.debug('auth', 'Supabase: signUp attempt');

      const { data, error } = await this.supabaseClient.auth.signUp({
        email,
        password,
        options,
      });

      if (error) {
        const normalized = this.mapSupabaseError(error);
        logger.debug('auth', 'Supabase signUp error:', normalized.toLog());
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
        logger.debug('auth', 'Supabase signUp success', {
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
      logger.error('auth', 'Supabase signUp exception:', normalized.toLog());
      return { success: false, error: normalized };
    }
  }

  /**
   * Sign in an existing user with email and password.
   * Returns session on success or normalized error.
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      logger.debug('auth', 'Supabase: signIn attempt');

      const { data, error } = await this.supabaseClient.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

      if (error) {
        const normalized = this.mapSupabaseError(error);
        logger.debug('auth', 'Supabase signIn error:', normalized.toLog());
        return { success: false, error: normalized };
      }

      if (data?.user && data?.session) {
        const session = this.sessionFromSupabaseSession(data.session);
        logger.info('auth', 'Supabase signIn success', { userId: data.user.id });
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
      logger.error('auth', 'Supabase signIn exception:', normalized.toLog());
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
      logger.debug('auth', 'Supabase: resetPassword attempt');

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
        logger.warn(
          'auth',
          'Supabase resetPassword error:',
          error.message
        );
        return {
          success: false,
          message: 'Failed to send reset email. Please try again.',
        };
      }

      logger.info('auth', 'Supabase resetPassword success');
      return {
        success: true,
        message: 'Reset email sent. Check your inbox.',
      };
    } catch (err) {
      logger.error('auth', 'Supabase resetPassword exception:', err);
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
      logger.debug('auth', 'Supabase: updatePassword attempt');

      const { error } = await this.supabaseClient.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        logger.warn('auth', 'Supabase updatePassword error:', error.message);
        
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

      logger.info('auth', 'Supabase updatePassword success');
      return { success: true };
    } catch (err) {
      logger.error('auth', 'Supabase updatePassword exception:', err);
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
        logger.warn('auth', 'Supabase getSession error:', error.message);
        return null;
      }

      if (data?.session) {
        return this.sessionFromSupabaseSession(data.session);
      }

      return null;
    } catch (err) {
      logger.error('auth', 'Supabase getSession exception:', err);
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
        logger.warn('auth', 'Supabase getUser error:', error.message);
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
      logger.error('auth', 'Supabase getUser exception:', err);
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
      logger.debug('auth', 'Supabase: signOut');

      const { error } = await this.supabaseClient.auth.signOut();

      if (error) {
        logger.warn('auth', 'Supabase signOut error:', error.message);
        // Don't throw; sign out partially succeeded
        return;
      }

      logger.info('auth', 'Supabase signOut success');
    } catch (err) {
      logger.error('auth', 'Supabase signOut exception:', err);
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
        logger.debug('auth', 'Supabase: restoreSession skipped (no session data)');
        return false;
      }

      logger.info('auth', 'Supabase: restoring session from storage', {
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
        logger.warn(
          'auth',
          'Supabase: failed to restore session',
          { error: error.message }
        );
        return false; // Session is invalid/expired
      }

      logger.info('auth', 'Supabase: session restored successfully', {
        userId: rawSession.user?.id,
      });
      return true;
    } catch (err) {
      logger.error('auth', 'Supabase: exception during session restore:', err);
      return false;
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

    logger.debug('auth', 'Mapping Supabase error:', {
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
      code === 'NETWORK_ERROR' ||
      code === 'ETIMEDOUT'
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
        'EMAIL_NOT_CONFIRMED',
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

    // Default: generic auth error
    return new AuthError(
      message,
      supabaseError,
      code,
      'An authentication error occurred. Please try again.'
    );
  }
}
