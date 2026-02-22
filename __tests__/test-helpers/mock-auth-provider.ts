import type { AuthProvider, AuthResult, Session } from '@/lib/services/auth-provider';
import { InvalidCredentialsError } from '@/lib/services/auth-provider';

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

    async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
      return { success: true, message: 'reset-sent' };
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
