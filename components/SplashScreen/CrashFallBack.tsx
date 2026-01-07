import { UseTheme, useScale } from "@/theme";

import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { Body, Button, Card, Title } from "../ui";
import VersionDisplay from "../VersionDisplay";

export interface CrashFallBackProps {
  error: Error | null;
  onRetry?: () => void;
}

// Fun D&D-themed error messages
const ERROR_MESSAGES = [
  "Oops! Someone spilled a drink on the character sheet!",
  "Oops! Your pencil broke mid-session!",
  "Oops! We encountered a TPK!",
  "Oops! The DM's notes got eaten by the dog!",
  "Oops! Natural 1!",
  "Oops! The dice rolled off the table!",
  "Oops! Someone forgot to bring snacks!",
  "Oops! The dragon decided to show up early!",
  "Oops! Critical fumble on the app loading!",
  "Oops! The tavern ran out of ale!",
  "Oops! Your spell fizzled!",
  "Oops! The mimic was actually the treasure chest!",
];

/**
 * Crash Fallback Screen
 *
 * Displayed when the app encounters an unrecoverable error caught by ErrorBoundary
 * Provides user-friendly error messaging and recovery options
 */
export function CrashFallBack({ error, onRetry }: CrashFallBackProps) {
  const { theme } = UseTheme();
  const S = useScale();
  const isDev = (process.env.EXPO_PUBLIC_ENVIRONMENT || 'production') === 'development';

  // Pick a random fun message
  const funMessage = useMemo(
    () => ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)],
    []
  );

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        backgroundColor: theme.background,
        padding: S.space.lg,
      }}
    >
      <Card
        padded
        bordered
        style={{
          width: "100%",
          padding: S.space.xl,
        }}
      >
        {/* Error Icon/Title */}
        <Title
          align="center"
          style={{
            color: theme.accent,
            marginBottom: S.space.md,
          }}
        >
          🎲 {funMessage}
        </Title>

        {/* User-friendly message */}
        <Body
          align="center"
          style={{
            color: theme.textSecondary,
            marginBottom: S.space.lg,
          }}
        >
          Don&apos;t worry - your adventure is safe! Try rolling for initiative
          (restarting) or contact your DM (support) if this keeps happening.
        </Body>

        {/* Development-only error details */}
        {isDev && error && (
          <Card
            bordered
            padded
            style={{
              backgroundColor: theme.surface,
              marginBottom: S.space.lg,
              maxHeight: 200,
            }}
          >
            <Body
              style={{
                color: theme.textSecondary,
                marginBottom: S.space.sm,
                fontWeight: "600",
              }}
            >
              Error Details (Development Only):
            </Body>
            <ScrollView style={{ maxHeight: 150 }}>
              <Body
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: theme.accent,
                }}
              >
                {error.name}: {error.message}
                {"\n\n"}
                {error.stack}
              </Body>
            </ScrollView>
          </Card>
        )}

        {/* Action Buttons */}
        <View
          style={{
            gap: S.space.sm,
            flexDirection: "column",
            alignItems: "stretch",
          }}
        >
          {onRetry && (
            <Button text="Try Again" variant="primary" onPress={onRetry} />
          )}

          <Button
            text="Restart App"
            variant="secondary"
            onPress={() => {
              // Force reload the app
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          />
        </View>

        {/* App Version Info */}
        <View style={{ alignItems: "center", marginTop: S.space.xs }}>
          <VersionDisplay />
        </View>
      </Card>
    </View>
  );
}
