import { View } from 'react-native';
import AuthButton from '../../components/custom_components/auth_components/AuthButton';
import AuthError from '../../components/custom_components/auth_components/AuthError';
import AuthInput from '../../components/custom_components/auth_components/AuthInput';
import AuthSuccess from '../../components/custom_components/auth_components/AuthSuccess';
import { ThemedText } from '../../components/themed-text';
import { useResetPasswordConfirm } from '../../lib/auth/useResetPasswordConfirm';

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
        
        <ThemedText 
          type="title" 
          style={{ marginBottom: 20, textAlign: 'center', color: '#F5E6D3', fontSize: 32, fontWeight: '700' }}
        >
          Reset Password
        </ThemedText>
        
        <ThemedText style={{ marginBottom: 40, textAlign: 'center', fontSize: 16, opacity: 0.8, color: '#F5E6D3', lineHeight: 22, paddingHorizontal: 20 }}>
          {userEmail ? `${userEmail} is ready to reset your password. Please enter a new password below.` : 'Please enter a new password below.'}
        </ThemedText>

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
              <ThemedText 
                style={{ 
                  textAlign: 'left', 
                  fontSize: 11, 
                  color: doPasswordsMatch ? '#A3D4A0' : '#F5A5A5', 
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
          <AuthError error={error} />
        </View>

        <View style={{ width: '100%', maxWidth: 300, gap: 16, backgroundColor: 'transparent' }}>
          {/* Reset Password Button */}
          {!success && (
            <AuthButton
              title="Reset Password"
              onPress={handleResetPassword}
              disabled={!isFormValid}
              loading={loading}
            />
          )}
          
          {/* Back to Sign In Button */}
          <ThemedText
            style={{ 
              textAlign: 'center', 
              fontSize: 14, 
              color: '#D4AF37', 
              fontWeight: '500',
              marginTop: success ? 0 : 8,
              textDecorationLine: 'underline'
            }}
            onPress={goToSignIn}
          >
            {success ? 'Continue to Sign In →' : '← Back to Sign In'}
          </ThemedText>
        </View>

        <ThemedText style={{ marginTop: 30, textAlign: 'center', fontSize: 12, opacity: 0.6, color: '#F5E6D3', lineHeight: 18, paddingHorizontal: 20 }}>
          {success ? 'Your password has been updated successfully!' : 'After changing your password, you\'ll be returned to the sign-in page.'}
        </ThemedText>
        <ThemedText style={{ marginTop: 8, textAlign: 'center', fontSize: 11, opacity: 0.5, color: '#F5E6D3', lineHeight: 16, paddingHorizontal: 20 }}>
          © 2025 The Snow Post · Forged for storytellers & adventurers
        </ThemedText>
      </View>
    </View>
  );
}