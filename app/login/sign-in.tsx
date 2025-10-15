import { CoreColors } from '@/constants/corecolors';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import AuthButton from '../../components/auth_components/AuthButton';
import AuthError from '../../components/auth_components/AuthError';
import AuthInput from '../../components/auth_components/AuthInput';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { useSignInForm } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/utils/logger';

export default function SignInScreen() {
  const router = useRouter();
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  
  const {
    // Form data
    email,
    password,
    loading,
    authError,
    showPassword,
    
    // Validation state
    emailValidation,
    isFormValid,
    
    // Handlers
    handleSignIn,
    handleEmailChange,
    handlePasswordChange,
    setShowPassword,
  } = useSignInForm();

  const handleResendConfirmationFromError = async (email: string) => {
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) {
        // Note: This would need to be handled differently since authError is managed by the hook
        logger.error('sign-in', 'Failed to resend email:', error.message);
      } else {
        logger.info('sign-in', 'Confirmation email sent!');
      }
    } catch {
      logger.error('sign-in', 'Failed to resend confirmation email.');
    } finally {
      setIsResendingEmail(false);
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
          Welcome Back
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          Sign in to access your saved worlds and characters
        </ThemedText>

        {/* Form Inputs */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 15, backgroundColor: 'transparent' }}>
          <AuthInput
            placeholder="Email"
            value={email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
            style={{
              borderColor: !emailValidation.isValid && email.length > 0 ? '#dc3545' : undefined,
              borderWidth: !emailValidation.isValid && email.length > 0 ? 2 : undefined
            }}
          />
          
          <AuthInput
            placeholder="Password"
            value={password}
            onChangeText={handlePasswordChange}
            secureTextEntry={true}
            editable={!loading}
            showPasswordToggle={true}
            onTogglePassword={() => setShowPassword(!showPassword)}
            showPassword={showPassword}
            style={{
              borderColor: !password.trim() && password.length > 0 ? '#dc3545' : undefined,
              borderWidth: !password.trim() && password.length > 0 ? 2 : undefined
            }}
          />

          {/* Authentication Error Display */}
          <AuthError 
            error={authError} 
            onResendEmail={authError === 'RESEND_EMAIL' ? () => handleResendConfirmationFromError(email) : undefined}
            isResending={isResendingEmail}
          />

          {/* Forgot Password Link - TODO: Add forgot password screen */}
          <ThemedText
            style={{ textAlign: 'right', fontSize: 13, color: '#D4AF37', fontWeight: '500', marginBottom: 4, cursor: 'pointer', marginTop: -14 }}
            //onPress={() => router.push('/login/forgot-password')}
          >
            Forgot Password?
          </ThemedText>

        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Sign In Button */}
          <AuthButton
            title="Sign In"
            onPress={handleSignIn}
            disabled={!isFormValid}
            loading={loading}
          />

          {/* Switch to Sign Up */}
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
            onPress={() => router.push('/login/sign-up')}
            disabled={loading}
          >
            Need an account? Sign Up
          </PrimaryButton>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </ThemedText>
        
        <ThemedText style={{ marginTop: 8, textAlign: 'center', fontSize: 11, opacity: 0.5, color: '#F5E6D3', lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </ThemedText>
      </View>
    </View>
  );
}