/**
 * Entitlement Expired Modal
 *
 * Displays when a user accesses a feature with an expired entitlement.
 * Minimal placeholder UI: shows entitlement name and provides a close button.
 *
 * Future enhancements:
 * - "Renew" button → billing/subscription flow
 * - "Don't remind me" → update entitlements.remind_user = false
 * - Detailed entitlement info and grace period countdown
 */

import { AppModal, Button } from '@/components/ui';
import { registerModal } from '@/contexts/modal-context';
import { useScale } from '@/theme';
import { View } from 'react-native';

export interface EntitlementExpiredModalProps {
  visible?: boolean;
  entitlementName?: string;
  onClose?: () => void;
  onRenew?: () => void;
  onDismiss?: () => void;
}

export function EntitlementExpiredModal({
  visible = false,
  entitlementName = 'Entitlement',
  onClose,
  onRenew,
  onDismiss,
}: EntitlementExpiredModalProps) {
  const S = useScale();
  const handleClose = onClose || (() => {});

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      heading="Entitlement Expired"
      body={`Your ${entitlementName} entitlement has expired.`}
      borderTone="danger"
    >
      <View
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: S.space.md,
        }}
      >
        <Button
          text="Close"
          onPress={handleClose}
          variant="primary"
          style={{ minWidth: S.s(120) }}
        />
      </View>
    </AppModal>
  );
}

// Register modal for centralized management
registerModal('entitlement-expired', EntitlementExpiredModal)
