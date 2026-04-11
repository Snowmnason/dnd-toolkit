import { AppModal, Button, Switch } from '@/components/ui';
import { registerModal } from '@/contexts';
import { $, useScale } from '@/theme';
import { useState } from 'react';
import { View } from 'react-native';
import { Body } from '../ui/AppText';

export interface TrustedUrlConsentModalProps {
  visible: boolean;
  url: string;
  hostname: string;
  onDismiss: () => void;
  onOpenAnyway: () => void;
  onTrustAndOpen: () => void;
}

/**
 * 🔗 TrustedUrlConsentModal
 *
 * Security consent modal shown when a user clicks an external/untrusted URL.
 * Prompts the user to confirm before leaving the app, with an optional
 * "trust this site" toggle to skip the prompt for future visits.
 *
 * Two outcomes:
 * - Go Back / Nevermind → `onDismiss` (no navigation)
 * - Go to Site → `onTrustAndOpen` if trust toggle is on, else `onOpenAnyway`
 */
export function TrustedUrlConsentModal({
  visible,
  url,
  hostname,
  onDismiss,
  onOpenAnyway,
  onTrustAndOpen,
}: TrustedUrlConsentModalProps) {
  const S = useScale();
  const [trustSite, setTrustSite] = useState(false);

  const handleGoToSite = () => {
    if (trustSite) {
      onTrustAndOpen();
    } else {
      onOpenAnyway();
    }
    setTrustSite(false);
  };

  const handleDismiss = () => {
    setTrustSite(false);
    onDismiss();
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleDismiss}
      heading="Leaving dnd-toolkit"
      body="This link is taking you on a side quest"
      borderTone="warning"
    >
      {/* URL display box */}
      <View
        style={{
          marginTop: S.space.md,
          borderRadius: S.radius.sm,
          borderWidth: 1,
          borderColor: $('border'),
          backgroundColor: $('surface'),
          paddingHorizontal: S.space.sm,
          paddingVertical: S.space.xs,
        }}
      >
        <Body
          style={{ color: $('textSecondary') }}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {url}
        </Body>
      </View>

      {/* Trust toggle */}
      <View style={{ marginTop: S.space.md }}>
        <Switch
          checked={trustSite}
          onChange={setTrustSite}
          rightLabel={`Trust ${hostname} links from now on`}
        />
      </View>

      {/* Buttons */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: S.space.sm,
          marginTop: S.space.md,
        }}
      >
        <Button
          text="Nevermind"
          onPress={handleDismiss}
          variant="ghost"
        />
        <Button
          text="Go to Site"
          onPress={handleGoToSite}
          variant="primary"
        />
      </View>
    </AppModal>
  );
}

// Register modal for centralized management
registerModal('trusted-url-consent', TrustedUrlConsentModal);
