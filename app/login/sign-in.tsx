import { AuthError, AuthInput } from '@/components/auth_components';
import { Body, BodyLogin, Button, Caption, SubTitle, Title } from '@/components/ui';
import { logger, supabase, useSignInForm } from '@/lib';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

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
        <Button
          bg='rgba(139,69,19,0.2)'
          textColor='#F5E6D3'
          onPress={() => router.replace('/login/welcome')}
          disabled={loading}
        >
          ← Back
        </Button>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        <Title>Welcome Back</Title>
        
        <BodyLogin opacity={0.8}>
          Sign in to access your saved worlds and characters
        </BodyLogin>

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
          <SubTitle color='#D4AF37' align='right' cursor='pointer' style={{ marginBottom: 4, marginTop: -14 }}
            onPress={() => router.push('/login/forgot-password')}
          >
            Forgot Password?
          </SubTitle>

        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Sign In Button */}
          <Button
            variant="auth"
            text="Sign In"
            onPress={handleSignIn}
            disabled={!isFormValid}
            loading={loading}
          />

          {/* Switch to Sign Up */}
          <Button bg='rgba(139, 69, 19, 0.15)' borderColor='#8B4513' textColor='#F5E6D3' 
            style={{ width: '100%', paddingVertical: 12, borderRadius: 8}} 
            onPress={() => router.push('/login/sign-up')} disabled={loading}>
              Need an account? Sign Up
          </Button>
        </View>
        <Body variant="semi" fontSize="$sm" color='#F5E6D3' align='center' opacity={0.6}
          style={{ marginTop: 30, lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </Body>

        <Caption color='#F5E6D3' align='center' style={{ marginTop: 8, opacity: 0.5, lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </Caption>
      </View>
    </View>
  );
}

/*
        <Button variant="ghost"
          style={{
            backgroundColor: loading
              ? 'rgba(139,69,19,0.1)'
              : 'rgba(139,69,19,0.2)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 6,
            opacity: loading ? 0.5 : 1,
          }}
          onPress={() => router.replace('/login/welcome')}
          disabled={loading}
        >
          <ButtonText
            style={{
              color: '#F5E6D3',
              fontSize: 14,
              fontWeight: '500',
            }}
          >
            ← Back
          </ButtonText>
        </Button>
        */