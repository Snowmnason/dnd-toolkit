export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings'] as const,
  publicRoutes: ['login', 'web'] as const,
  redirectOnUnauthenticated: '/login/sign-in' as const,
};