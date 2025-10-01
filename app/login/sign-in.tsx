import { CoreColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import AuthButton from '../../components/custom_components/auth_components/AuthButton';
import AuthError from '../../components/custom_components/auth_components/AuthError';
import AuthInput from '../../components/custom_components/auth_components/AuthInput';
import { validateEmail } from '../../components/custom_components/auth_components/authUtils';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { AuthStateManager } from '../../lib/auth-state';
import { supabase } from '../../lib/supabase';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const handleSignIn = async () => {
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
    if (!password.trim()) {
      setAuthError('Password is required');
      return;
    }
    
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setAuthError('Incorrect email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setAuthError('RESEND_EMAIL');
        } else if (error.message.includes('User not found')) {
          setAuthError('No account found with this email. Please check your email or create an account.');
        } else {
          setAuthError(error.message || 'Sign in failed. Please try again.');
        }
      } else {
        // Sign in successful
        await AuthStateManager.setHasAccount(true);
        
        // Check if username is needed
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.user_metadata?.username) {
          router.replace('/login/complete-profile' as any);
        } else {
          router.replace('/select/world-selection');
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmationFromError = async (email: string) => {
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) {
        setAuthError(`Failed to resend email: ${error.message}`);
      } else {
        setAuthError('✅ Confirmation email sent! Check your inbox.');
        setTimeout(() => setAuthError(''), 3000);
      }
    } catch {
      setAuthError('Failed to resend confirmation email. Please try again.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const isFormValid = email && password && validateEmail(email).isValid;

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

          {/* Forgot Password Link */}
          <ThemedText
            style={{ textAlign: 'right', fontSize: 13, color: '#D4AF37', fontWeight: '500', marginBottom: 4, cursor: 'pointer' }}
            onPress={() => router.push('./login/auth?action=reset-password')}
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
            onPress={() => router.push('/login/auth?action=signup' as any)}
            disabled={loading}
          >
            Need an account? Sign Up
          </PrimaryButton>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          Secure authentication powered by Supabase
        </ThemedText>
      </View>
    </View>
  );
}