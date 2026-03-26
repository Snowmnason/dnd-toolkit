import {
    ERROR_MESSAGES,
    getRandomMessage,
    NAVIGATION_ERROR_MESSAGES,
    SAFE_MODE_MESSAGES,
} from "@/localization/ErrorMessages";
import { useScale, UseTheme } from "@/theme";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import VersionDisplay from "../VersionDisplay";
import { Body, Title } from "./AppText";
import { Button } from "./BaseButton";
import { Card } from "./ElevatedView";

type ErrorMessagePack = "default" | "safe-mode" | "navigation";

export interface ErrorFallbackShellProps {
  /** Which pool of fun D&D messages to pick from */
  messagePack?: ErrorMessagePack;

  /** What failed — shown as a subtitle under the fun message (e.g., "Critical Error", "Navigation Error") */
  errorTitle?: string;

  /** Short, user-friendly explanation of what happened */
  explanation?: string;

  /** The error object — only shown when showDetails is true (dev mode) */
  error?: Error;
  /** Whether to render the dev-only error details box */
  showDetails?: boolean;

  /** Button 1: Go back / easiest recovery (always present) */
  primaryButtonText: string;
  onPrimaryAction: () => void | Promise<void>;

  /** Button 2: Take specific action (clear data, force relog, send report, etc.) */
  secondaryButtonText?: string;
  onSecondaryAction?: () => void | Promise<void>;

  /** Button 3: Action without sending data (consent-aware alternative) */
  tertiaryButtonText?: string;
  onTertiaryAction?: () => void | Promise<void>;
}

/**
 * ErrorFallbackShell — base error screen component (like AppModal for modals).
 *
 * Pure UI. Does not contain any domain logic, analytics, or navigation.
 * Specific error screens (CrashFallBack, SafeModeScreen, NavigationErrorScreen)
 * wrap this and provide their own logic + button handlers.
 *
 * Layout:
 *   Card
 *     🎲 Fun D&D message
 *     Error title (what failed)
 *     Explanation (user-friendly)
 *     Dev-only error details box
 *     1-3 buttons
 *     Footer
 */
export function ErrorFallbackShell({
  messagePack = "default",
  errorTitle,
  explanation,
  error,
  showDetails = false,
  primaryButtonText,
  onPrimaryAction,
  secondaryButtonText,
  onSecondaryAction,
  tertiaryButtonText,
  onTertiaryAction,
}: ErrorFallbackShellProps) {
  const { theme } = UseTheme();
  const S = useScale();

  let messages: readonly string[];
  switch (messagePack) {
    case "safe-mode":
      messages = SAFE_MODE_MESSAGES;
      break;
    case "navigation":
      messages = NAVIGATION_ERROR_MESSAGES;
      break;
    default:
      messages = ERROR_MESSAGES;
      break;
  }
  const funMessage = useMemo(
    () => getRandomMessage(messages),
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
        {/* Fun D&D message */}
        <Title
          align="center"
          style={{
            color: theme.accent,
            marginBottom: errorTitle ? S.space.sm : S.space.lg,
          }}
        >
          🎲 {funMessage}
        </Title>

        {/* What failed */}
        {errorTitle && (
          <Body
            align="center"
            style={{
              color: theme.textPrimary,
              fontWeight: "600",
              fontSize: 16,
              marginBottom: S.space.lg,
            }}
          >
            {errorTitle}
          </Body>
        )}

        {/* User-friendly explanation */}
        {explanation && (
          <Body
            align="center"
            style={{
              marginBottom: S.space.lg,
              lineHeight: 1.6,
              opacity: 0.9,
            }}
          >
            {explanation}
          </Body>
        )}

        {/* Dev-only error details */}
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

        {/* Action buttons (1-3) */}
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
          {tertiaryButtonText && onTertiaryAction && (
            <Button
              text={tertiaryButtonText}
              variant="secondary"
              onPress={onTertiaryAction}
            />
          )}
        </View>

        {/* Footer */}
        <View style={{ alignItems: "center", marginTop: S.space.xs }}>
          <VersionDisplay />
        </View>
      </Card>
    </View>
  );
}
