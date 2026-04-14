import type { RouteConfig } from '../navigationConfig'

// Root and login-related routes (includes anonymous style playground)
export const LOGIN_ROUTES: RouteConfig[] = [
  {
    path: '/',
    title: 'D&D Toolkit',
    analyticsName: 'root_index',
  },
  {
    path: '/login',
    aliases: ['/login/welcome'],
    title: 'Welcome',
    analyticsName: 'login_welcome',
  },
  {
    path: '/login/sign-in',
    title: 'Sign In',
    analyticsName: 'login_signin',
  },
  {
    path: '/login/create-account',
    title: 'Create Account',
    analyticsName: 'login_create',
  },
  {
    path: '/login/sign-up',
    title: 'Create Account',
    analyticsName: 'login_signup',
  },
  {
    path: '/login/forgot-password',
    title: 'Forgot Password',
    analyticsName: 'login_forgot',
  },
  {
    path: '/login/reset-password',
    title: 'Reset Password',
    analyticsName: 'login_reset',
  },
  {
    path: '/login/confirm-signin',
    title: 'Confirm Sign In',
    analyticsName: 'login_confirm',
  },
  {
    path: '/login/email-confirmation',
    title: 'Confirm Your Email',
    analyticsName: 'login_email_confirm',
  },
  {
    path: '/login/complete-profile',
    title: 'Complete Profile',
    analyticsName: 'login_complete_profile',
  },
  {
    path: '/StyleDesktop',
    aliases: ['/styledesktop'],
    title: 'Component Playground (Anonymous)',
    analyticsName: 'style_desktop_anonymous',
  },
]

