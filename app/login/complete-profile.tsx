import CustomLoad from '@/components/custom_components/CustomLoad';
import { usersDB } from '@/lib/database/users';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, View } from 'react-native';
import CustomModal from '../../components/CustomModal';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import TextInput from '../../components/custom_components/TextInput';
import { ThemedText } from '../../components/themed-text';
import { supabase } from '../../lib/supabase';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Animation for validation feedback
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ⚡ Real-time validation functions - same pattern as login screens
  const validateUsername = (value: string) => {
    if (!value.trim()) {
      return { isValid: false, message: 'Username required', color: '#6c757d' };
    }
    if (value.length < 3) {
      return { isValid: false, message: 'Username too short', color: '#dc3545' };
    }
    if (value.length > 20) {
      return { isValid: false, message: 'Username too long', color: '#dc3545' };
    }
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      return { isValid: false, message: 'Letters and numbers only', color: '#dc3545' };
    }
    return { isValid: true, message: 'Username looks good!', color: '#28a745' };
  };

  const validateFirstName = (value: string) => {
    // First name is optional
    if (!value.trim()) {
      return { isValid: true, message: 'Optional field', color: '#6c757d' };
    }
    if (value.length > 30) {
      return { isValid: false, message: 'Name too long', color: '#dc3545' };
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(value)) {
      return { isValid: false, message: 'Letters, numbers, and spaces only', color: '#dc3545' };
    }
    return { isValid: true, message: 'Name looks good!', color: '#28a745' };
  };

  // Helper functions for hint colors
  const getUsernameHintColor = () => {
    if (!username) return '#F5E6D3';
    const validation = validateUsername(username);
    return validation.isValid ? '#A3D4A0' : '#F5A5A5';
  };

  const getFirstNameHintColor = () => {
    if (!firstName) return '#F5E6D3';
    const validation = validateFirstName(firstName);
    return validation.isValid ? '#A3D4A0' : '#F5A5A5';
  };

  // Get current user info on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || '');
          // Pre-fill first name if available from OAuth
          if (user.user_metadata?.full_name) {
            setFirstName(user.user_metadata.full_name.split(' ')[0] || '');
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
    const usernameValidation = validateUsername(username);
    const firstNameValidation = validateFirstName(firstName);
    
    // Don't submit if validations fail - show user feedback
    if (!usernameValidation.isValid || !firstNameValidation.isValid) {
      triggerShake();
      if (!usernameValidation.isValid) {
        setValidationError(`Username issue: ${usernameValidation.message}`);
      } else if (!firstNameValidation.isValid) {
        setValidationError(`Name issue: ${firstNameValidation.message}`);
      }
      return;
    }
    
    // Clear any validation errors if we get here
    setValidationError('');

    setLoading(true);
    try {
      // Create user profile in our custom table
      await usersDB.create({
        auth_id: (await supabase.auth.getUser()).data.user?.id || '',
        username: username.trim(),
        display_name: firstName.trim() || undefined,
      });

      // Mark profile as complete by setting role
      const { error: roleError } = await supabase.auth.updateUser({
        data: {
          role: 'complete'
        }
      });

      if (roleError) {
        Alert.alert('Update Error', roleError.message);
        return;
      }

      // Profile completed successfully
      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while creating your profile');
      console.error('Profile creation error:', error);
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
            📝 PROFILE FORM - Cross-platform with shake animation
            Future: Add profile picture, bio, etc.
            ========================================== */}
        <Animated.View 
          style={{ 
            width: '100%', 
            maxWidth: 300, 
            marginBottom: 30, 
            backgroundColor: 'transparent',
            transform: [{ translateX: shakeAnimation }]
          }}
        >
          <TextInput
            placeholder="Username (required)"
            value={username}
            onChangeText={(text: string) => {
              setUsername(text);
              if (validationError) setValidationError('');
            }}
            autoCapitalize="none"
            style={{ 
              marginBottom: 8,
              borderColor: !validateUsername(username).isValid && username.length > 0 ? '#dc3545' : undefined,
              borderWidth: !validateUsername(username).isValid && username.length > 0 ? 2 : undefined
            }}
          />
          
          {/* Username Validation Hint */}
          {username.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <ThemedText 
                style={{ 
                  textAlign: 'left', 
                  fontSize: 11, 
                  color: getUsernameHintColor(), 
                  fontWeight: '500', 
                  lineHeight: 16,
                  opacity: 0.9
                }}
              >
                {(() => {
                  const validation = validateUsername(username);
                  if (validation.isValid) {
                    return `Welcome aboard, ${username.trim()}!`;
                  } else {
                    return validation.message;
                  }
                })()}
              </ThemedText>
            </View>
          )}
          
          <TextInput
            placeholder="First Name (optional)"
            value={firstName}
            onChangeText={(text: string) => {
              setFirstName(text);
              if (validationError) setValidationError('');
            }}
            style={{ 
              marginBottom: 8,
              borderColor: !validateFirstName(firstName).isValid && firstName.length > 0 ? '#dc3545' : undefined,
              borderWidth: !validateFirstName(firstName).isValid && firstName.length > 0 ? 2 : undefined
            }}
          />
          
          {/* First Name Validation Hint */}
          {firstName.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <ThemedText 
                style={{ 
                  textAlign: 'left', 
                  fontSize: 11, 
                  color: getFirstNameHintColor(), 
                  fontWeight: '500', 
                  lineHeight: 16,
                  opacity: 0.9
                }}
              >
                {(() => {
                  const validation = validateFirstName(firstName);
                  if (validation.isValid) {
                    return `Hello, ${firstName.trim()}!`;
                  } else {
                    return validation.message;
                  }
                })()}
              </ThemedText>
            </View>
          )}
        </Animated.View>

        {/* Validation Error Display */}
        {validationError ? (
          <View style={{ width: '100%', maxWidth: 300, marginBottom: 15, backgroundColor: 'transparent' }}>
            <ThemedText style={{ 
              textAlign: 'center', 
              fontSize: 14, 
              color: '#dc3545', 
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: 'rgba(220, 53, 69, 0.3)'
            }}>
              {validationError}
            </ThemedText>
          </View>
        ) : null}

        {/* ==========================================
            🔘 ACTION BUTTONS - Same styling as login
            ========================================== */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Complete Profile Button */}
          <PrimaryButton
            style={{ 
              width: '100%', 
              backgroundColor: (() => {
                const usernameValid = validateUsername(username).isValid;
                const firstNameValid = validateFirstName(firstName).isValid;
                return (loading || !usernameValid || !firstNameValid) ? '#6c757d' : '#8B4513';
              })(),
              paddingVertical: 16, 
              borderRadius: 8,
              opacity: (() => {
                const usernameValid = validateUsername(username).isValid;
                const firstNameValid = validateFirstName(firstName).isValid;
                return (loading || !usernameValid || !firstNameValid) ? 0.6 : 1;
              })()
            }}
            textStyle={{ color: '#F5E6D3', fontSize: 16, fontWeight: '600' }}
            onPress={handleCompleteProfile}
            disabled={loading || !validateUsername(username).isValid || !validateFirstName(firstName).isValid}
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
          Username: 3-20 characters, letters and numbers only
        </ThemedText>
        <ThemedText style={{ marginTop: 10, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
            Your Username helps friends find you and keeps your adventures organized. First name is optional for local games!
        </ThemedText>
      </View>

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
    </View>
  );
}