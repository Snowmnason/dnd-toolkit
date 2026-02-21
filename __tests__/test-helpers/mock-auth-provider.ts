import type { AuthProvider, AuthResult, Session } from '@/lib/services/auth-provider';

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
        return { success: false, error: new Error('invalid') as any };
      }
      return { success: true, data: { userId: `user:${email}`, accessToken: 'tok' } };
    },

    async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
      return { success: true, message: 'reset-sent' };
    },

    async getSession(): Promise<Session | null> {
      return { userId: 'user:test', accessToken: 'tok' };
    },

    onAuthStateChange(callback: (session: Session | null) => void): () => void {
      // no-op: fire nothing
      return () => {};
    },

    async signOut(): Promise<void> {
      return;
    },
  };

  return Object.assign(defaultProvider, overrides || {});
}
