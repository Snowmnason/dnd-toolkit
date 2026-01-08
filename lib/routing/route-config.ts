export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings'] as const,
  publicRoutes: ['login', 'web'] as const,
  redirectOnUnauthenticated: '/login/welcome' as const,
};

export type ProtectedRoute = typeof AUTH_CONFIG.protectedRoutes[number];