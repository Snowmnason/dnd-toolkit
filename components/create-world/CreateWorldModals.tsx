import { useRouter } from 'expo-router';
import CustomModal from '../CustomModal';

interface CreateWorldModalsProps {
  showSignInModal: boolean;
  setShowSignInModal: (show: boolean) => void;
  showValidationModal: boolean;
  setShowValidationModal: (show: boolean) => void;
  showSuccessModal: boolean;
  setShowSuccessModal: (show: boolean) => void;
  successWorldName: string;
  onSuccessNavigate: () => void;
}

export default function CreateWorldModals({
  showSignInModal,
  setShowSignInModal,
  showValidationModal,
  setShowValidationModal,
  showSuccessModal,
  setShowSuccessModal,
  successWorldName,
  onSuccessNavigate
}: CreateWorldModalsProps) {
  const router = useRouter();

  return (
    <>
      {/* Sign In Required Modal */}
      <CustomModal
        visible={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        title="Sign In Required"
        message="You need to sign in to create and save worlds. Would you like to sign in now?"
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowSignInModal(false),
            style: 'cancel'
          },
          {
            text: 'Sign In',
            onPress: () => {
              setShowSignInModal(false);
              router.push('/login/welcome');
            },
            style: 'primary'
          }
        ]}
      />

      {/* Validation Modal */}
      <CustomModal
        visible={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="World Name Required"
        message="Please enter a name for your world before creating it."
        buttons={[
          {
            text: 'Got it',
            onPress: () => setShowValidationModal(false),
            style: 'primary'
          }
        ]}
      />

      {/* Success Modal */}
      <CustomModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onSuccessNavigate();
        }}
        title="Success!"
        message={`World "${successWorldName}" created and saved to your account!`}
        buttons={[
          {
            text: 'Continue',
            onPress: () => {
              setShowSuccessModal(false);
              onSuccessNavigate();
            },
            style: 'primary'
          }
        ]}
      />
    </>
  );
}