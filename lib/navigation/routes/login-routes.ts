import type { RouteConfig } from '../navigation-config'

// Root and login-related routes (includes anonymous style playground)
export const LOGIN_ROUTES: RouteConfig[] = [
  {
    path: '/',
    title: 'D&D Toolkit',
    showTopBar: false,
    animation: 'fade',
    analyticsName: 'root_index',
  },
  {
    path: '/login',
    aliases: ['/login/welcome'],
    title: 'Welcome',
    showTopBar: false,
    animation: 'fade',
    analyticsName: 'login_welcome',
  },
  {
    path: '/login/sign-in',
    title: 'Sign In',
    showTopBar: false,
    back: '/',
    analyticsName: 'login_signin',
  },
  {
    path: '/login/create-account',
    title: 'Create Account',
    showTopBar: false,
    back: '/',
    analyticsName: 'login_create',
  },
  {
    path: '/login/sign-up',
    title: 'Create Account',
    showTopBar: false,
    back: '/',
    analyticsName: 'login_signup',
  },
  {
    path: '/login/forgot-password',
    title: 'Forgot Password',
    showTopBar: false,
    back: '/login/sign-in',
    analyticsName: 'login_forgot',
  },
  {
    path: '/login/reset-password',
    title: 'Reset Password',
    showTopBar: false,
    back: '/login/sign-in',
    analyticsName: 'login_reset',
  },
  {
    path: '/login/confirm-signin',
    title: 'Confirm Sign In',
    showTopBar: false,
    back: '/login/sign-in',
    analyticsName: 'login_confirm',
  },
  {
    path: '/login/email-confirmation',
    title: 'Confirm Your Email',
    showTopBar: false,
    back: '/login/sign-in',
    analyticsName: 'login_email_confirm',
  },
  {
    path: '/login/complete-profile',
    title: 'Complete Profile',
    showTopBar: false,
    back: '/',
    analyticsName: 'login_complete_profile',
  },
  {
    path: '/login/auth-redirect',
    title: 'Authenticating…',
    showTopBar: false,
    back: '/',
    analyticsName: 'login_auth_redirect',
  },
  {
    path: '/StyleDesktop',
    aliases: ['/styledesktop'],
    title: 'Component Playground (Anonymous)',
    showTopBar: true,
    showHamburger: false,
    back: '/',
    animation: 'slide',
    analyticsName: 'style_desktop_anonymous',
  },
]

