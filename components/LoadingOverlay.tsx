import { useKernelError } from '@/hooks/kernel';
import { UseTheme } from '@/theme';
import { Text, View } from 'react-native';
import CustomLoad from './ui/CustomLoad';

interface LoadingOverlayProps {
  message?: string
  assetsLoaded?: boolean
}

export default function LoadingOverlay({
  message = 'Loading...',
  assetsLoaded = false,
}: LoadingOverlayProps) {
  const { theme } = UseTheme();
  const kernelError = useKernelError();

  // If kernel error during bootstrap, show it
  if (kernelError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.background,
          zIndex: 9999,
          paddingHorizontal: 20,
        }}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`Bootstrap error: ${kernelError.message}`}
      >
        <View style={{ alignItems: 'center', gap: 12 }}>
          <CustomLoad size="large" />
          <Text style={{ color: theme.danger, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            {kernelError.message}
          </Text>
          {kernelError.phase && (
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
              Failed at: {kernelError.phase}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.background,
        zIndex: 9999,
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={assetsLoaded ? 'Checking authentication...' : message}
    >
      <CustomLoad size="large" />
    </View>
  )
}
