import CustomLoad from '@/components/custom_components/CustomLoad';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import CustomModal from '../../components/CustomModal';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInput from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { supabase } from '../../lib/supabase';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  // Get current user info on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || '');
          // Pre-fill full name if available from OAuth
          if (user.user_metadata?.full_name) {
            setFullName(user.user_metadata.full_name);
          }
        } else {
          // No user found, redirect to login
          router.replace('/login/welcome');
        }
      } catch (error) {
        console.error('Error getting user:', error);
        router.replace('/login/welcome');
      }
    };

    getCurrentUser();
  }, [router]);

  const handleCompleteProfile = async () => {
    if (!username.trim()) {
      setValidationMessage('Please enter a username to continue');
      setShowValidationModal(true);
      return;
    }

    // Basic username validation
    if (username.length < 3) {
      setValidationMessage('Username must be at least 3 characters long');
      setShowValidationModal(true);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setValidationMessage('Username can only contain letters, numbers, hyphens, and underscores');
      setShowValidationModal(true);
      return;
    }

    setLoading(true);
    try {
      // Update user metadata with username and full name
      const { error } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          full_name: fullName.trim() || undefined,
        }
      });

      if (error) {
        Alert.alert('Update Error', error.message);
      } else {
        // Profile completed successfully
        setShowSuccessModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error('Profile update error:', error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      {/* Back Button */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'transparent' }}>
        <PrimaryButton
          style={{ backgroundColor: 'rgba(139, 69, 19, 0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}
          textStyle={{ color: '#8B4513', fontSize: 14, fontWeight: '500' }}
          onPress={() => router.replace('/login/welcome')}
        >
          ← Back
        </PrimaryButton>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        {/* ==========================================
            👤 PROFILE COMPLETION SCREEN
            ==========================================
            📱 MOBILE: Touch-optimized form with virtual keyboard support
            🖥️ DESKTOP: Mouse and keyboard friendly with same responsive design
            Future: Will serve as base for profile edit page
            ========================================== */}
        
        <ThemedText 
          type="title" 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          Complete Your Profile
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 20, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          Just a few more details to get you started on your adventure
        </ThemedText>

        {/* Show user's email */}
        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 14, color: '#D4AF37', fontWeight: '500', paddingHorizontal: 20 }}>
          Account: {userEmail}
        </ThemedText>

        {/* ==========================================
            📝 PROFILE FORM - Cross-platform
            Future: Add profile picture, bio, etc.
            ========================================== */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 30, backgroundColor: 'transparent' }}>
          <TextInput
            placeholder="Username (required)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            style={{ marginBottom: 16 }}
          />
          
          <TextInput
            placeholder="Full Name (optional)"
            value={fullName}
            onChangeText={setFullName}
            style={{ marginBottom: 16 }}
          />
        </View>

        {/* ==========================================
            🔘 ACTION BUTTONS - Same styling as login
            ========================================== */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Complete Profile Button */}
          <PrimaryButton
            style={{ width: '100%', backgroundColor: '#8B4513', paddingVertical: 16, borderRadius: 8 }}
            textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
            onPress={handleCompleteProfile}
            disabled={loading}
          >
            {loading ? (
              <CustomLoad size="small" />
            ) : (
              'Complete Profile'
            )}
          </PrimaryButton>
        </View>

        {/* Tips */}
        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          Username must be 3+ characters and can contain letters, numbers, hyphens, and underscores
        </ThemedText>
        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
            Your Username helps friends find you and keeps your adventures organized. You can also add your name if you want to avoid confusion in local games!
        </ThemedText>
      </View>

      {/* Validation Modal */}
      <CustomModal
        visible={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="Username Issue"
        message={validationMessage}
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
          router.replace('/select/world-selection');
        }}
        title="Profile Complete! 🎉"
        message="Welcome to your D&D Toolkit adventure! Your profile has been set up successfully."
        buttons={[
          {
            text: 'Continue',
            onPress: () => {
              setShowSuccessModal(false);
              router.replace('/select/world-selection');
            },
            style: 'primary'
          }
        ]}
      />

      {/* Skip Confirmation Modal */}
      <CustomModal
        visible={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        title="Skip Profile Setup?"
        message="You can always complete your profile later in settings. Continue without username?"
        buttons={[
          {
            text: 'Go Back',
            onPress: () => setShowSkipModal(false),
            style: 'cancel'
          },
          {
            text: 'Skip For Now',
            onPress: () => {
              setShowSkipModal(false);
              router.replace('/select/world-selection');
            },
            style: 'primary'
          }
        ]}
      />
    </View>
  );
}