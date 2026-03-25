import { SplashScreen } from '@/components/SplashScreen';
import { useLoadingContext } from '@/contexts/loading-context';
import { View } from 'react-native';

/**
 * LoadingBlocker
 *
 * Single full-screen UI blocker mounted at root level in app/_layout.tsx.
 * Renders <SplashScreen> with context-driven state (Discord-style: title, subtitle, spinner, progress, message).
 *
 * CRITICAL: Uses absolute positioning with high zIndex to overlay on top of app content
 * and prevent flex layout conflicts with RootLayoutContent.
 *
 * Any system (kernel, navigation, storage, services) can trigger this blocker
 * by calling setLoading() from useLoadingContext().
 *
 * When isLoading is false, renders nothing (zero runtime cost).
 *
 * Example:
 * ```ts
 * const { setLoading } = useLoadingContext();
 * setLoading({
 *   title: 'D&D Toolkit',
 *   subtitle: 'Initializing...',
 *   message: 'Preparing your campaign...',
 *   progress: 45,
 *   showProgress: true,
 * });
 * ```
 */
export function LoadingBlocker() {
  const {
    isLoading,
    title,
    subtitle,
    message,
    progress,
    showProgress,
    decorativeElement,
  } = useLoadingContext();

  console.log(`[ui] [LoadingBlocker] render — isLoading=${isLoading}, title="${title}", subtitle="${subtitle}"`);

  if (!isLoading) {
    console.log('[ui] [LoadingBlocker] → returning NULL (hidden)');
    return null;
  }

  console.log('[ui] [LoadingBlocker] → rendering SplashScreen overlay');
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      <SplashScreen
        title={title}
        subtitle={subtitle}
        message={message}
        progress={progress}
        showProgress={showProgress}
        decorativeElement={decorativeElement}
      />
    </View>
  );
}
