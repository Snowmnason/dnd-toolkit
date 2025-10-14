import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAppParams } from '../contexts/AppParamsContext';

interface UseSuccessNavigationProps {
  showSuccessModal: boolean;
  successWorldId: string;
}

export function useSuccessNavigation({ showSuccessModal, successWorldId }: UseSuccessNavigationProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const successTimeoutRef = useRef<number | null>(null);
  const router = useRouter();
  const { params } = useAppParams();

  const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

  // Auto-navigate after 30 seconds if success modal is shown
  useEffect(() => {
    if (showSuccessModal && !isNavigating) {
      successTimeoutRef.current = setTimeout(() => {
        if (!isNavigating) { // Double-check before navigating
          setIsNavigating(true);
          // Navigate to world-selection for safety (prevents 404 if world ID issues)
          router.replace({
            pathname: '/select/world-selection',
            params: params.userId ? { userId: params.userId } : {}
          });
        }
      }, 30000); // 30 second timeout
    }

    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, [showSuccessModal, isNavigating, router, params.userId]);

  const navigateToWorld = () => {
    if (!isNavigating) {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      setIsNavigating(true);
      
      // Navigate directly to the created world for immediate use
      if (successWorldId) {
        const routeParams: any = { worldId: successWorldId };
        if (params.userId) routeParams.userId = params.userId;
        
        router.replace({
          pathname: isDesktop ? '/main/desktop' : '/main/mobile',
          params: routeParams
        });
      } else {
        // Fallback if no world ID
        router.replace({
          pathname: '/select/world-selection',
          params: params.userId ? { userId: params.userId } : {}
        });
      }
    }
  };

  return {
    isNavigating,
    navigateToWorld,
    setIsNavigating
  };
}