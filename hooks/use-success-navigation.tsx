import { buildNavigationTarget } from '@/lib/navigation/uri-helpers';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

interface UseSuccessNavigationProps {
  showSuccessModal: boolean;
  successWorldId: string;
}

export function useSuccessNavigation({ showSuccessModal, successWorldId }: UseSuccessNavigationProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Auto-navigate after 30 seconds if success modal is shown
  useEffect(() => {
    if (showSuccessModal && !isNavigating) {
      successTimeoutRef.current = setTimeout(() => {
        if (!isNavigating) { // Double-check before navigating
          setIsNavigating(true);
          // Navigate to world-selection for safety (prevents 404 if world ID issues)
          const target = buildNavigationTarget('/select/world-selection', {}, []);
          router.replace(target as any);
        }
      }, 30000); // 30 second timeout
    }

    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, [showSuccessModal, isNavigating]);

  const navigateToWorld = () => {
    if (!isNavigating) {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      setIsNavigating(true);
      
      // Navigate directly to the created world for immediate use
      if (successWorldId) {
        const target = buildNavigationTarget(
          '/main/main-landing',
          { worldId: successWorldId },
          ['worldId']
        );
        router.replace(target as any);
      } else {
        // Fallback if no world ID
        const target = buildNavigationTarget('/select/world-selection', {}, []);
        router.replace(target as any);
      }
    }
  };

  return {
    isNavigating,
    navigateToWorld,
    setIsNavigating
  };
}