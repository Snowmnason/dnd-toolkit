import type { AuthProvider, AuthResult, Session } from '@/system/Services/auth-adapter';
import { InvalidCredentialsError } from '@/system/Services/auth-adapter';

export function createMockAuthProvider(overrides?: Partial<AuthProvider>): AuthProvider {
  const defaultProvider: AuthProvider = {
    async signUp(email: string, password: string): Promise<AuthResult> {
      return {
        success: true,
        data: { userId: `user:${email}`, accessToken: 'tok' },
      };
    },

    async signIn(email: string, password: string): Promise<AuthResult> {
      if (email === 'bad@example.com') {
        return { success: false, error: new InvalidCredentialsError('Invalid credentials', new Error('invalid')) };
      }
      return { success: true, data: { userId: `user:${email}`, accessToken: 'tok' } };
    },

    async refreshSession(): Promise<any> {
      return { userId: 'user:test@example.com', accessToken: 'tok' };
    },

    async signInWithOAuth(
      provider: string,
      options?: Record<string, any>
    ): Promise<{ url?: string; session?: Session }> {
      // Mock: return a fake OAuth URL (tests can override if needed)
      return { url: `https://auth.example.com/oauth/${provider}?callback=app://success` };
    },

    async signInWithIdToken(
      provider: string,
      token: string,
      options?: Record<string, any>
    ): Promise<AuthResult> {
      // Mock: simulate successful ID token sign-in
      return { success: true, data: { userId: `user:${provider}`, accessToken: token } };
    },

    async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
      return { success: true, message: 'reset-sent' };
    },

    async resend(email: string): Promise<{ success: boolean; message?: string }> {
      return { success: true, message: 'confirmation-sent' };
    },

    async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
      return { success: true };
    },

    async getSession(): Promise<Session | null> {
      return { userId: 'user:test', accessToken: 'tok' };
    },

    async getUser(): Promise<Session | null> {
      // Mock: same as getSession (no real server round-trip in tests)
      return { userId: 'user:test', accessToken: 'tok' };
    },

    onAuthStateChange(callback: (session: Session | null) => void): () => void {
      // no-op: fire nothing
      return () => {};
    },

    async signOut(): Promise<void> {
      return;
    },

    async restoreSession(rawSession: any): Promise<boolean> {
      // Mock always succeeds in restoring sessions
      return !!rawSession?.userId;
    },
  };

  return Object.assign(defaultProvider, overrides || {});
}
