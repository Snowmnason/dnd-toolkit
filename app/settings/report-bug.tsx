/**
 * Report Bug / Suggestions Page
 *
 * Page for users to report bugs and submit suggestions.
 * Currently a placeholder page that navigates back to settings.
 *
 * FUTURE: Implement form for users to:
 * - Write bug report or suggestion
 * - Attach diagnostic information from safe mode
 * - Submit feedback to support/backend
 */

import { AppPage, Body, Title } from "@/components/ui";
import { useScale } from "@/theme";
import { useEffect } from "react";
import { View } from "react-native";

export default function ReportBugPage() {
  const S = useScale();

  useEffect(() => {
    // TODO: Implement bug report/suggestion form
    // For now, this is a placeholder page
  }, []);

  return (
    <AppPage>
      <View style={{ padding: S.space.lg, gap: S.space.lg }}>
        <Title>Report a Bug or Suggestion</Title>

        <Body>Thank you for helping us improve D&D Toolkit!</Body>

        <Body style={{ opacity: 0.7 }}>
          This page is currently under development. Please check back soon to
          submit your feedback.
        </Body>

        {/* TODO: Add form for bug report/suggestion */}
        {/* - Title/subject field */}
        {/* - Description textarea */}
        {/* - Category selector (bug/suggestion/other) */}
        {/* - Attachment for diagnostics */}
        {/* - Submit button */}
      </View>
    </AppPage>
  );
}
