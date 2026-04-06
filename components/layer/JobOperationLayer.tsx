/**
 * JobOperationLayer
 *
 * Skeleton layer for the Job Operation panel overlay.
 * Owns: positioning, z-index, enter/exit animations, pointer-event passthrough.
 * Delegates: all visual content to <JobOperationPanel /> (the component).
 *
 * Rendered in RootLayoutContent alongside SnackBarLayer, AppToastLayer, etc.
 * Consumes JobOperationContext for visibility gating and passes state down.
 *
 * Z-index hierarchy:
 *   Modals: 1300+  |  OverlayProvider: 1200  |  JobOperationLayer: 1100  |  Snackbar: 1000
 */

import { useJobOperationContext } from '@/providers/JobOperationProvider';
import { useScale } from '@/theme';
import { Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { JobOperationPanel } from '../ui/JobOperationPanel';

export function JobOperationLayer() {
  const ctx = useJobOperationContext();
  const S = useScale();

  // Nothing to show — no jobs in list
  if (!ctx.hasJobs) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        position: 'absolute',
        bottom: S.space.xxl + S.space.xl * 2, // above snackbar
        right: S.space.md,
        zIndex: 1100,
        width: Platform.OS === 'web' ? S.space.xxl * 12 : S.space.xl * 10,
        // Pass-through touches to content beneath when not over panel
        pointerEvents: 'box-none' as const,
      }}
    >
      {/* Inner view catches touches on the panel itself */}
      <Animated.View style={{ pointerEvents: 'auto' as const }}>
        <JobOperationPanel />
      </Animated.View>
    </Animated.View>
  );
}
