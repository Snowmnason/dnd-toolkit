import { S } from '@/theme'
import React from 'react'
import { View, ViewProps } from 'react-native'

/* ────────────────────────────────────────
   🧱 Auth View Primitives
   Used to replace repetitive inline styles
   in login / sign-up / password screens.
────────────────────────────────────────── */

/* — Root Container — */
export const AuthRoot = ({ style, ...props }: ViewProps) => (
  <View
    style={[
      {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: S.space.lg,
      },
      style,
    ]}
    {...props}
  />
)

/* — Back Button Wrapper — */
export const AuthBackButtonContainer = ({ style, ...props }: ViewProps) => (
  <View
    style={[
      {
        position: 'absolute',
        top: 50,
        left: S.space.lg,
        zIndex: 10,
      },
      style,
    ]}
    {...props}
  />
)

/* — Header (Title + Subtitle area) — */
export const AuthHeader = ({ style, ...props }: ViewProps) => (
  <View
    style={[
      {
        alignItems: 'center',
        marginBottom: S.space.xxl,
      },
      style,
    ]}
    {...props}
  />
)

/* — Form Wrapper — */
export const AuthForm = ({ style, ...props }: ViewProps) => (
  <View
    style={[
      {
        width: '100%',
        maxWidth: 300,
        marginBottom: S.space.md,
      },
      style,
    ]}
    {...props}
  />
)

/* — Action Button Group — */
export const AuthActionGroup = ({ style, ...props }: ViewProps) => (
  <View
    style={[
      {
        width: '100%',
        maxWidth: 300,
        gap: S.space.md,
      },
      style,
    ]}
    {...props}
  />
)

/* — Footer (small text area) — */
export const AuthFooter = ({ style, ...props }: ViewProps) => (
  <View
    style={[
      {
        alignItems: 'center',
        marginTop: S.space.xxl,
      },
      style,
    ]}
    {...props}
  />
)

/* — Optional Utility (Centered Flex) — */
export const AuthCentered = ({ style, ...props }: ViewProps) => (
  <View
    style={[
      {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}
    {...props}
  />
)
