import { Body, Caption, Link, SubTitle, Title } from "@/components/ui/AppText";
import { Button } from "@/components/ui/BaseButton";
import { useScale } from "@/theme";
import React from "react";
import { Platform } from "react-native";

/* ──────────
   🔘 Auth Buttons (extend BaseButton)
──────────── */

export function AuthButton({
  style,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      bg="#8B4513"
      borderColor="#D4AF37"
      textColor="#F5E6D3"
      style={[{ width: "100%" }, style]}
      {...props}
    />
  );
}

export function AuthButtonSecondary({
  style,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      bg="rgba(139,69,19,0.15)"
      borderColor="#8B4513"
      textColor="#F5E6D3"
      style={[{ width: "100%" }, style]}
      {...props}
    />
  );
}

export function AuthButtonBack({
  style,
  ...props
}: React.ComponentProps<typeof Button>) {
  const S = useScale();
  const widthStyle: number | "auto" =
    Platform.OS === "ios" || Platform.OS === "android" ? 80 : "auto";

  return (
    <Button
      bg="rgba(139,69,19,0.2)"
      borderColor="transparent"
      textColor="#F5E6D3"
      style={[
        {
          height: S.button.sm.height,
          paddingHorizontal: S.button.sm.paddingHorizontal,
          borderRadius: S.radius.sm,
          width: widthStyle,
          alignSelf: "flex-start",
        },
        style,
      ]}
      {...props}
    />
  );
}

/* ──────────
   🔤 Auth Text Components (extend AppText)
──────────── */

export function AuthTitle({
  style,
  ...props
}: React.ComponentProps<typeof Title>) {
  const S = useScale();
  return (
    <Title
      color="#F5E6D3"
      align="center"
      style={[{ marginBottom: S.space.lg }, style]}
      {...props}
    />
  );
}

export function AuthSubTitle({
  style,
  ...props
}: React.ComponentProps<typeof SubTitle>) {
  const S = useScale();
  return (
    <SubTitle
      fontSize="$body2"
      color="#F5E6D3"
      lineHeight={S.font.body2 + 2}
      align="center"
      style={[
        {
          marginBottom: S.space.xl,
          opacity: 0.8,
          alignSelf: "stretch",
          flexShrink: 1,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function AuthBody({
  style,
  ...props
}: React.ComponentProps<typeof Body>) {
  const S = useScale();
  return (
    <Body
      color="#F5E6D3"
      align="center"
      opacity={0.8}
      style={[
        {
          lineHeight: 22,
          paddingHorizontal: S.space.lg,
          marginBottom: S.space.lg,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function AuthBodyFooter({
  style,
  ...props
}: React.ComponentProps<typeof Body>) {
  const S = useScale();
  return (
    <Body
      variant="semi"
      fontSize="$subtitle"
      color="#F5E6D3"
      align="center"
      opacity={0.6}
      style={[
        {
          lineHeight: 22,
          paddingHorizontal: S.space.lg,
          marginBottom: S.space.sm,
        },
        style,
      ]}
      {...props}
    />
  );
}

AuthBody.InCard = function AuthBodyInCard({
  style,
  ...props
}: React.ComponentProps<typeof Body>) {
  const S = useScale();
  return (
    <Body
      fontSize="$para"
      color="#8B4513"
      align="center"
      opacity={0.95}
      style={[
        {
          lineHeight: 22,
          paddingHorizontal: S.space.md,
          marginBottom: 0,
        },
        style,
      ]}
      {...props}
    />
  );
};

export function AuthCaption({
  style,
  ...props
}: React.ComponentProps<typeof Caption>) {
  return (
    <Caption
      color="#F5E6D3"
      align="center"
      opacity={0.5}
      lineHeight={16}
      style={[style]}
      {...props}
    />
  );
}

export function AuthLink({
  style,
  ...props
}: React.ComponentProps<typeof Link>) {
  const S = useScale();
  return (
    <Link
      align="center"
      opacity={0.9}
      style={[
        {
          lineHeight: 22,
          paddingHorizontal: S.space.lg,
          marginBottom: S.space.sm,
        },
        style,
      ]}
      {...props}
    />
  );
}
