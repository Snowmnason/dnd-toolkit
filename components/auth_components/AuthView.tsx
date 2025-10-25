import { useScale } from '@/theme'
import React from 'react'
import { View, ViewProps } from 'react-native'

/* ────────────────────────────────────────
   🧱 Auth View Primitives
   Used to replace repetitive inline styles
   in login / sign-up / password screens.
   
   ✨ Uses dynamic sizing via useScale() hook
   that updates live when window resizes!
────────────────────────────────────────── */

/* — Root Container — */
export const AuthRoot = ({ style, ...props }: ViewProps) => {
  const S = useScale()
  return (
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
}

/* — Back Button Wrapper — */
export const AuthBackButtonContainer = ({ style, ...props }: ViewProps) => {
  const S = useScale()
  return (
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
}

/* — Header (Title + Subtitle area) — */
export const AuthHeader = ({ style, ...props }: ViewProps) => {
  const S = useScale()
  return (
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
}

/* — Form Wrapper — */
export const AuthForm = ({ style, ...props }: ViewProps) => {
  const S = useScale()
  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: S.s(400),
          marginBottom: S.space.xxl,
        },
        style,
      ]}
      {...props}
    />
  )
}

/* — Action Button Group — */
export const AuthActionGroup = ({ style, ...props }: ViewProps) => {
  const S = useScale()
  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth: S.s(380),
          gap: S.space.md,
          marginBottom: S.space.lg,
        },
        style,
      ]}
      {...props}
    />
  )
}

/* — Footer (small text area) — */
export const AuthFooter = ({ style, ...props }: ViewProps) => {
  const S = useScale()
  return (
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
}

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
