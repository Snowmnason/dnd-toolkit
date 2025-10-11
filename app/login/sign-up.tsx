import { CoreColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import AuthButton from '../../components/auth_components/AuthButton';
import AuthError from '../../components/auth_components/AuthError';
import AuthInput from '../../components/auth_components/AuthInput';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import CustomModal from '../../components/CustomModal';
import { ThemedText } from '../../components/themed-text';
import { useSignUpForm } from '../../lib/auth';

export default function SignUpScreen() {
  const router = useRouter();
  const {
    // Form data
    email,
    password,
    confirmPassword,
    loading,
    authError,
    showPassword,
    showEmailExistsModal,
    
    // Validation state
    passwordValidation,
    emailValidation,
    passwordsMatch,
    isFormValid,
    
    // Handlers
    handleSignUp,
    handleEmailChange,
    handlePasswordChange,
    handleConfirmPasswordChange,
    setShowPassword,
    setShowEmailExistsModal,
    
    // UI helpers
    getPasswordHintColor,
    getPasswordRequirementsText,
    getPasswordMatchText,
  } = useSignUpForm();

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
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 2, backgroundColor: 'transparent' }}>
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
              borderColor: !passwordValidation.isValid && password.length > 0 ? '#dc3545' : undefined,
              borderWidth: !passwordValidation.isValid && password.length > 0 ? 2 : undefined
            }}
          />
          {/* Password Requirements */}
          <View style={{ marginBottom: 6, marginTop: -14 }}>
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
              {getPasswordRequirementsText()}
            </ThemedText>
          </View>
          
          <AuthInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            secureTextEntry={true}
            showPassword={showPassword}
            editable={!loading}
            style={{
              borderColor: confirmPassword.length > 0 && password !== confirmPassword ? '#dc3545' : undefined,
              borderWidth: confirmPassword.length > 0 && password !== confirmPassword ? 2 : undefined
            }}
          />
          {/* Password Match Indicator */}
          {confirmPassword.length > 0 && (
            <View style={{ marginBottom: 6, marginTop: -14 }}>
              <ThemedText 
                style={{ 
                  textAlign: 'left', 
                  fontSize: 11, 
                  color: passwordsMatch ? '#A3D4A0' : '#F5A5A5', 
                  fontWeight: '500', 
                  lineHeight: 16,
                  opacity: 0.9
                }}
              >
                {getPasswordMatchText()}
              </ThemedText>
            </View>
          )}

          {/* Authentication Error Display */}
          <AuthError error={authError} />
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
            onPress={() => router.push('/login/sign-in')}
            disabled={loading}
          >
            Already have an account? Sign In
          </PrimaryButton>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          After confirming your email, you&apos;ll choose a username to complete your account setup.
        </ThemedText>
        
        <ThemedText style={{ marginTop: 8, textAlign: 'center', fontSize: 11, opacity: 0.5, color: '#F5E6D3', lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
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
              router.push('/login/sign-in');
            },
            style: 'primary'
          }
        ]}
      />
    </View>
  );
}