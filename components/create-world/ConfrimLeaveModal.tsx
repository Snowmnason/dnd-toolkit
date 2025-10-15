import React from 'react';
import CustomModal from '../modals/CustomModal';

interface LeaveWorldModalProps {
  visible: boolean;
  onClose: () => void;
  worldName: string;
  onLeaveWorld: () => Promise<void>;
}

export default function LeaveWorldModal({
  visible,
  onClose,
  worldName,
  onLeaveWorld,
}: LeaveWorldModalProps) {
  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title={worldName ? `Confirm Leave ${worldName}` : 'Confirm Leave this World'}
      message={`Are you sure you want to leave ${worldName}? You will lose access to this world and all its content.`}
      buttons={[
        {
          text: 'Cancel',
          onPress: onClose,
          style: 'cancel'
        },
        {
          text: 'Confirm Leave',
          onPress: onLeaveWorld,
          style: 'destructive'
        }
      ]}
    />
  );
}