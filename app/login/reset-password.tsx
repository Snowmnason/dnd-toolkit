import { AuthError, AuthInput, AuthSuccess } from '@/components/auth_components';
import { Body, BodyLogin, Button, Caption, SubTitle, Title } from '@/components/ui';
import { useResetPasswordConfirm } from '@/lib';
import { View } from 'react-native';

export default function ResetPasswordScreen() {
  const {
    // Form data
    password,
    confirmPassword,
    loading,
    error,
    success,
    successMessage,
    showPassword,
    userEmail,
    
    // Validation state
    isPasswordValid,
    doPasswordsMatch,
    isFormValid,
    
    // Handlers
    handleResetPassword,
    handlePasswordChange,
    handleConfirmPasswordChange,
    setShowPassword,
    goToSignIn,
  } = useResetPasswordConfirm();

  // Helper functions for UI state
  const getPasswordHintColor = () => {
    if (password.length === 0) return '#A3D4A0';
    return isPasswordValid ? '#A3D4A0' : '#F5A5A5';
  };

  const getPasswordRequirementsText = () => {
    if (password.length === 0) return 'Password must be at least 6 characters';
    return isPasswordValid ? '✓ Password meets requirements' : '✗ Password must be at least 6 characters';
  };

  const getPasswordMatchText = () => {
    return doPasswordsMatch ? '✓ Passwords match' : '✗ Passwords do not match';
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'transparent' }}>
        
        <Title> Reset Password </Title>
        
        <BodyLogin opacity={0.8} >
          {userEmail ? `${userEmail} is ready to reset your password. Please enter a new password below.` : 'Please enter a new password below.'}
        </BodyLogin>

        {/* Success Message */}
        {success && (
          <AuthSuccess message={successMessage} />
        )}

        {/* Form Inputs */}
        <View style={{ width: '100%', maxWidth: 300, marginBottom: 2, backgroundColor: 'transparent' }}>

          <AuthInput
            placeholder="Password"
            value={password}
            onChangeText={handlePasswordChange}
            secureTextEntry={!showPassword}
            editable={!loading && !success}
            showPasswordToggle={true}
            onTogglePassword={() => setShowPassword(!showPassword)}
            showPassword={showPassword}
            style={{
              borderColor: !isPasswordValid && password.length > 0 ? '#dc3545' : undefined,
              borderWidth: !isPasswordValid && password.length > 0 ? 2 : undefined
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
              }}>
              {getPasswordRequirementsText()}
            </SubTitle>
          </View>
          
          <AuthInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            secureTextEntry={!showPassword}
            editable={!loading && !success}
            style={{
              borderColor: confirmPassword.length > 0 && password !== confirmPassword ? '#dc3545' : undefined,
              borderWidth: confirmPassword.length > 0 && password !== confirmPassword ? 2 : undefined
            }}
          />
          {/* Password Match Indicator */}
          {confirmPassword.length > 0 && (
            <View style={{ marginBottom: 6, marginTop: -14 }}>
              <SubTitle
                color={doPasswordsMatch ? '#A3D4A0' : '#F5A5A5'}
                align='left'
                style={{
                  lineHeight: 16,
                  opacity: 0.9
                }}>
                {getPasswordMatchText()}
              </SubTitle>
            </View>
          )}

          {/* Authentication Error Display */}
          <AuthError error={error} />
        </View>

        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Reset Password Button */}
          {!success && (
            <Button
              variant='auth'
              text="Reset Password"
              onPress={handleResetPassword}
              disabled={!isFormValid} loading={loading}
            />
          )}
          
          {/* Back to Sign In Button */}
          <Body color='#D4AF37' align='center' cursor='pointer' deco='underline' style={{ marginTop: success ? 0 : 8, }} onPress={goToSignIn}>
            {success ? 'Continue to Sign In →' : '← Back to Sign In'}
          </Body>
        </View>

        <BodyLogin opacity={0.6}>
          {success ? 'Your password has been updated successfully!' : 'After changing your password, you\'ll be returned to the sign-in page.'}
        </BodyLogin>
        <Caption color='#F5E6D3' align='center' style={{ marginTop: 8, opacity: 0.5, lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </Caption>
      </View>
    </View>
  );
}