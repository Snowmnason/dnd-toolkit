import { AuthError, AuthInput } from '@/components/auth_components';
import { Body, BodyLogin, Button, Caption, SubTitle, Title } from '@/components/ui';
import { useSignUpForm } from '@/lib';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import CustomModal from '../../components/modals/CustomModal';

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
        
        <Title>Create Account</Title>
        
        <BodyLogin opacity={0.8}> Join the adventure and sync your worlds across devices </BodyLogin>

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
            <SubTitle
              color={getPasswordHintColor()}
              align='left'
              fontSize={11}
              style={{ 
                lineHeight: 16,
                opacity: 0.9
              }}
            >
              {getPasswordRequirementsText()}
            </SubTitle>
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
              <SubTitle
              color={passwordsMatch ? '#A3D4A0' : '#F5A5A5'}
              align='left'
              fontSize={11}
              style={{ 
                lineHeight: 16,
                opacity: 0.9
              }}>
                {getPasswordMatchText()}
              </SubTitle>
            </View>
          )}

          {/* Authentication Error Display */}
          <AuthError error={authError} />
        </View>

        {/* Action Buttons */}
        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Create Account Button */}
          <Button
            variant="auth"
            text="Create Account"
            onPress={handleSignUp}
            disabled={!isFormValid} loading={loading}
          />

          {/* Switch to Sign In */}
          <Button
            bg='rgba(139, 69, 19, 0.15)' borderColor='#8B4513' textColor='#F5E6D3'
            style={{ width: '100%', paddingVertical: 12, borderRadius: 8 }}
            onPress={() => router.push('/login/sign-in')}
            disabled={loading}
          >
            Already have an account? Sign In
          </Button>
        </View>

        <Body variant="semi" fontSize="$sm" color='#F5E6D3' align='center' opacity={0.6}
          style={{ marginTop: 30, lineHeight: 18, paddingHorizontal: 20 }}>
          After confirming your email, you&apos;ll choose a username to complete your account setup.
        </Body>

        <Caption color='#F5E6D3' align='center' style={{ marginTop: 8, opacity: 0.5, lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </Caption>
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