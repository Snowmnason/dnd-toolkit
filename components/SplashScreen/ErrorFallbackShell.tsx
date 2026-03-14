import { Body, Button, Card, Title } from "@/components/ui";
import { UseTheme, useScale } from "@/theme";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";

// Fun D&D-themed error messages (shared across all error fallbacks)
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

// Safe mode-specific messages (when app enters degraded/recovery)
const SAFE_MODE_MESSAGES = [
  "⚠️ The DM needs to pause the session",
  "⚠️ A critical scroll was lost!",
  "⚠️ The tavern is temporarily closed",
  "⚠️ Your map is unraveling!",
  "⚠️ The dungeon is unstable",
  "⚠️ Your dice are acting strange",
  "⚠️ The spell backfired!",
  "⚠️ A magical barrier appeared",
];

type ErrorMessagePack = "default" | "safe-mode";

export interface ErrorFallbackShellProps {
  /** The error object to display */
  error?: Error;
  /** Whether to show detailed error information (e.g., error message/stack) */
  showDetails?: boolean;
  /** User-friendly recovery message */
  recoveryMessage?: string;
  /** Primary button text for recovery action */
  primaryButtonText: string;
  /** Primary button callback (can be async) */
  onPrimaryAction: () => void | Promise<void>;
  /** Optional secondary button text */
  secondaryButtonText?: string;
  /** Optional secondary button callback (can be async) */
  onSecondaryAction?: () => void | Promise<void>;
  /** Optional footer content (e.g., VersionDisplay) */
  footer?: React.ReactNode;
  /** Message pack to use ('default' or 'safe-mode') */
  messagePack?: ErrorMessagePack;
}

/**
 * Shared error fallback UI shell
 *
 * Consolidates the visual and messaging patterns used by both RouteErrorBoundary
 * and CrashFallBack, ensuring consistency across error handling.
 *
 * Props allow callers to customize recovery behavior without duplicating UI code.
 * Use messagePack='safe-mode' for Safe Mode screens, 'default' for regular errors.
 */
export function ErrorFallbackShell({
  error,
  showDetails = false,
  recoveryMessage = "Don't worry - your adventure is safe! Try recovering or contact support if this keeps happening.",
  primaryButtonText,
  onPrimaryAction,
  secondaryButtonText,
  onSecondaryAction,
  footer,
  messagePack = "default",
}: ErrorFallbackShellProps) {
  const { theme } = UseTheme();
  const S = useScale();

  // Pick a random fun message from the selected pack
  const messages =
    messagePack === "safe-mode" ? SAFE_MODE_MESSAGES : ERROR_MESSAGES;
  const funMessage = useMemo(
    () => messages[Math.floor(Math.random() * messages.length)],
    [messages],
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
            marginBottom: S.space.lg,
          }}
        >
          🎲 {funMessage}
        </Title>

        {/* User-friendly recovery message FIX USERFRIENDLY MESSAGE */}
        <Body
          align="center"
          style={{
            marginBottom: S.space.lg,
            marginTop: S.space.md,
            lineHeight: 1.6,
            opacity: 0.9,
          }}
        >
          Dont worry - your adventure is safe! Try recovering or contact support if this keeps happening.
        </Body>

        {/* Error details (shown only when requested and error exists) */}
        {error && showDetails && (
          <Card
            bordered
            padded
            style={{
              marginBottom: S.space.lg,
              width: "100%",
              backgroundColor: theme.surface,
            }}
          >
            <Body
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                opacity: 0.8,
                color: theme.textSecondary,
              }}
            >
              {error.message}
            </Body>
            {error.stack && (
              <ScrollView style={{ maxHeight: 150, marginTop: S.space.sm }}>
                <Body
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    opacity: 0.6,
                    color: theme.textSecondary,
                  }}
                >
                  {error.stack}
                </Body>
              </ScrollView>
            )}
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
          <Button
            text={primaryButtonText}
            variant="primary"
            onPress={onPrimaryAction}
          />
          {secondaryButtonText && onSecondaryAction && (
            <Button
              text={secondaryButtonText}
              variant="secondary"
              onPress={onSecondaryAction}
            />
          )}
        </View>

        {/* Footer (e.g., VersionDisplay) */}
        {footer && (
          <View style={{ alignItems: "center", marginTop: S.space.xs }}>
            {footer}
          </View>
        )}
      </Card>
    </View>
  );
}
