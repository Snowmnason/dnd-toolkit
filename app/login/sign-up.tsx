import { CoreColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import AuthButton from '../../components/custom_components/auth_components/AuthButton';
import AuthError from '../../components/custom_components/auth_components/AuthError';
import AuthInput from '../../components/custom_components/auth_components/AuthInput';
import { isExistingUser, validateEmail, validatePassword } from '../../components/custom_components/auth_components/authUtils';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import CustomModal from '../../components/CustomModal';
import { ThemedText } from '../../components/themed-text';
import { supabase } from '../../lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false);

  const handleSignUp = async () => {
    setAuthError('');
    
    // Defensive client-side validation with user feedback
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      if (!email.trim()) {
        setAuthError('Email is required');
      } else if (!emailValidation.hasAtSymbol) {
        setAuthError('Email must contain @ symbol');
      } else if (!emailValidation.hasDomain) {
        setAuthError('Email must have a valid domain');
      } else {
        setAuthError('Please enter a valid email address');
      }
      return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      if (!password.trim()) {
        setAuthError('Password is required');
      } else {
        setAuthError('Password must meet all requirements above');
      }
      return;
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password 
      });

      // Give Supabase a moment to process
      await new Promise(resolve => setTimeout(resolve, 500));

      if (error) {
        // Check for email already exists error
        if (error.message.includes('User already registered') || 
            error.message.includes('already registered') || 
            error.message.includes('already been registered') ||
            error.message.includes('email address not available') ||
            error.message.includes('duplicate key value') ||
            error.code === '23505') {
          setShowEmailExistsModal(true);
          return;
        }
        
        if (error.message.includes('Password')) {
          setAuthError('Password does not meet requirements. Please check and try again.');
        } else {
          setAuthError(error.message || 'Account creation failed. Please try again.');
        }
      } else {
        // Check if this is an existing user trying to sign up again
        if (isExistingUser(data)) {
          setShowEmailExistsModal(true);
          return;
        }
        
        // Successful signup - redirect to email confirmation with auto-signin
        router.replace(`/login/email-confirmation?email=${encodeURIComponent(email)}` as any);
      }
    } catch (error) {
      console.error('Sign up error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordValidation = validatePassword(password);
  const emailValidation = validateEmail(email);
  const isFormValid = emailValidation.isValid && passwordValidation.isValid;

  // Get password hint color based on validation
  const getPasswordHintColor = () => {
    if (!password) return '#F5E6D3'; // Default when no password
    
    switch (passwordValidation.strength) {
      case 'weak': return '#F5E6D3';
      case 'medium': return '#D4AF37';
      case 'strong': return '#A3D4A0';
      default: return '#F5E6D3';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      {/* Back Button */}
      <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 10, backgroundColor: 'transparent' }}>
        <PrimaryButton
          style={{ 
            backgroundColor: loading ? 'rgba(139, 69, 19, 0.1)' : 'rgba(139, 69, 19, 0.2)', 
            paddingHorizontal: 16, 
            paddingVertical: 8, 
            borderRadius: 6,
            opacity: loading ? 0.5 : 1
          }}
          textStyle={{ color: CoreColors.textPrimary, fontSize: 14, fontWeight: '500' }}
          onPress={() => router.replace('/login/welcome')}
          disabled={loading}
        >
          ← Back
        </PrimaryButton>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        <ThemedText 
          type="title" 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          Create Account
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          Join the adventure and sync your worlds across devices
        </ThemedText>

        {/* Form Inputs */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 15, backgroundColor: 'transparent' }}>
          <AuthInput
            placeholder="Email"
            value={email}
            onChangeText={(text: string) => {
              setEmail(text);
              if (authError) setAuthError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            style={{
              borderColor: !validateEmail(email).isValid && email.length > 0 ? '#dc3545' : undefined,
              borderWidth: !validateEmail(email).isValid && email.length > 0 ? 2 : undefined
            }}
          />
          
          <AuthInput
            placeholder="Password"
            value={password}
            onChangeText={(text: string) => {
              setPassword(text);
              if (authError) setAuthError('');
            }}
            secureTextEntry={true}
            editable={!loading}
            showPasswordToggle={true}
            onTogglePassword={() => setShowPassword(!showPassword)}
            showPassword={showPassword}
            style={{
              borderColor: !validatePassword(password).isValid && password.length > 0 ? '#dc3545' : undefined,
              borderWidth: !validatePassword(password).isValid && password.length > 0 ? 2 : undefined
            }}
          />

          {/* Authentication Error Display */}
          <AuthError error={authError} />

          {/* Password Requirements */}
          <View style={{ marginBottom: 4 }}>
            <ThemedText 
              style={{ 
                textAlign: 'left', 
                fontSize: 11, 
                color: getPasswordHintColor(), 
                fontWeight: '500', 
                lineHeight: 16,
                opacity: 0.9
              }}
            >
              {password ? (() => {
                const missingCriteria = [];
                if (!passwordValidation.minLength) missingCriteria.push('6+ characters');
                if (!passwordValidation.hasUppercase) missingCriteria.push('uppercase letter');
                if (!passwordValidation.hasLowercase) missingCriteria.push('lowercase letter');
                if (!passwordValidation.hasNumber) missingCriteria.push('number');
                
                if (passwordValidation.isValid) {
                  return '✅ Password meets all requirements!';
                } else {
                  return `Need: ${missingCriteria.join(', ')}`;
                }
              })() : 'Password must be at least 6 characters with at least 1 uppercase letter, 1 lowercase letter, and 1 number.'}
            </ThemedText>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Create Account Button */}
          <AuthButton
            title="Create Account"
            onPress={handleSignUp}
            disabled={!isFormValid}
            loading={loading}
          />

          {/* Switch to Sign In */}
          <PrimaryButton
            style={{ 
              width: '100%', 
              backgroundColor: 'rgba(139, 69, 19, 0.15)', 
              borderWidth: 1, 
              borderColor: '#8B4513', 
              paddingVertical: 12, 
              borderRadius: 8,
              opacity: loading ? 0.5 : 1
            }}
            textStyle={{ color: '#F5E6D3', fontSize: 13, fontWeight: '500' }}
            onPress={() => router.push('/login/auth?action=signin' as any)}
            disabled={loading}
          >
            Already have an account? Sign In
          </PrimaryButton>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </ThemedText>
      </View>

      {/* Email Already Exists Modal */}
      <CustomModal
        visible={showEmailExistsModal}
        onClose={() => setShowEmailExistsModal(false)}
        title="Account Already Exists! 🤔"
        message={`An account with ${email} already exists. Would you like to sign in instead?`}
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setShowEmailExistsModal(false),
            style: 'cancel'
          },
          {
            text: 'Sign In',
            onPress: () => {
              setShowEmailExistsModal(false);
              router.push('/login/auth?action=signin' as any);
            },
            style: 'primary'
          }
        ]}
      />
    </View>
  );
}