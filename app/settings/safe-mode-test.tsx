import { SafeModeScreen } from "@/components/SplashScreen";
import { Body, Button, Card, Heading } from "@/components/ui";
import {
    AffectedFeature,
    RecoveryAction,
    SafeModeLevel,
    SafeModeReason,
} from "@/lib/error/safe-mode";
import { useScale, UseTheme } from "@/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

export default function SafeModeTestScreen() {
  const router = useRouter();
  const S = useScale();
  const { theme } = UseTheme();
  const [showSafeMode, setShowSafeMode] = useState(false);
  const [safeModeLevel, setSafeModeLevel] = useState<SafeModeLevel>(
    SafeModeLevel.DEGRADED,
  );

  if (showSafeMode) {
    return (
      <SafeModeScreen
        state={{
          level: safeModeLevel,
          reason: SafeModeReason.NETWORK_SYNC_FAILURES,
          affectedFeatures: [AffectedFeature.SYNC, AffectedFeature.PREMIUM],
          recoveryOptions: [
            RecoveryAction.CLEAR_CACHE,
            RecoveryAction.RESET_AUTH,
            RecoveryAction.CONTACT_SUPPORT,
          ],
          timestamp: Date.now(),
        }}
        onNavigateHome={() => setShowSafeMode(false)}
        onRecoveryAction={() => setShowSafeMode(false)}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: S.space.md,
        gap: S.space.lg,
        paddingBottom: S.space.xxl,
        backgroundColor: theme.background,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <Heading>Safe Mode Tester</Heading>
        <Body style={{ marginBottom: S.space.md }}>Test safe mode screens</Body>
        <View style={{ gap: S.space.sm }}>
          <Button
            variant="primary"
            text="Enter Degraded Mode"
            onPress={() => {
              setSafeModeLevel(SafeModeLevel.DEGRADED);
              setShowSafeMode(true);
            }}
          />
          <Button
            variant="primary"
            text="Enter Safe Mode"
            onPress={() => {
              setSafeModeLevel(SafeModeLevel.SAFE);
              setShowSafeMode(true);
            }}
          />
          <Button
            variant="outlined"
            text="Enter Recovery Mode"
            onPress={() => {
              setSafeModeLevel(SafeModeLevel.RECOVERY);
              setShowSafeMode(true);
            }}
          />
          <Button
            variant="secondary"
            text="Back"
            onPress={() => router.back()}
          />
        </View>
      </Card>
    </ScrollView>
  );
}
