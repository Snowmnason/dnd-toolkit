import { AppModal, Button } from '@/components/ui';

interface AccessDeniedModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AccessDeniedModal({ visible, onClose }: AccessDeniedModalProps) {
  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      heading="You ventured down the wrong path"
      body="We do not see that you have access to this world. You can go to settings to refresh your data, or ask the DM for a new invite."
    >
      <Button text="Continue" variant="secondary" onPress={onClose} />
    </AppModal>
  );
}
