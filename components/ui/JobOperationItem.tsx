/**
 * JobOperationItem
 *
 * Single job row inside the JobOperationPanel.
 *
 * Status → Visual:
 *   pending   → spinner (CustomLoad mode="spinner")
 *   active    → circular ProgressBar (synced via ref)
 *   completed → checkmark icon
 *   error     → red alert icon + AppTooltip with full error text on hover
 *
 * Buttons per status:
 *   pending/active → [Cancel]
 *   completed      → [Dismiss]
 *   error          → [Retry] + [Dismiss]
 *
 * Left border is colored by job type via theme tokens (JobUpload/JobDownload/JobBackground).
 *
 * TODO (mobile): Tooltips don't work on touch. Implement fallback for mobile error display
 * (e.g., long-press toast or tap to expand inline).
 */

import { $, useScale, UseTheme } from '@/theme';
import { JOB_TYPE_COLOR_TOKENS, type JobOperation } from '@/type-definitions/job-operation';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Body } from './AppText';
import { AppTooltip } from './AppToolTip';
import CustomLoad from './CustomLoad';
import { ProgressBar, type ProgressBarRef } from './ProgressBar';

export interface JobOperationItemProps {
  job: JobOperation;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}

export function JobOperationItem({
  job,
  onCancel,
  onDismiss,
  onRetry,
}: JobOperationItemProps) {
  const S = useScale();
  const { theme } = UseTheme();
  const progressRef = useRef<ProgressBarRef>(null);

  // Keep circular progress in sync with job.progress
  useEffect(() => {
    if (job.status === 'active') {
      progressRef.current?.setProgress(job.progress);
    }
  }, [job.progress, job.status]);

  const typeColor = $(JOB_TYPE_COLOR_TOKENS[job.type] as any, theme);

  // ── Status indicator ───────────────────────────────────
  const renderStatusIcon = () => {
    switch (job.status) {
      case 'pending':
        return <CustomLoad mode="spinner" size={20} />;
      case 'active':
        return (
          <ProgressBar
            ref={progressRef}
            variant="circular"
            size={S.size.sm}
            initialProgress={job.progress}
            highlightColor={typeColor}
          />
        );
      case 'completed':
        return (
          <Ionicons
            name="checkmark-circle"
            size={S.size.sm}
            color={$('success' as any, theme)}
          />
        );
      case 'error':
        return (
          <Ionicons
            name="alert-circle"
            size={S.size.sm}
            color={$('danger' as any, theme)}
          />
        );
    }
  };

  // ── Action buttons (icon-only with tooltips) ────────────
  const btnBase = {
    padding: S.space.xxs ?? 2,
    borderRadius: S.radius.sm,
    backgroundColor: $('surfaceAlt' as any, theme),
    marginLeft: S.space.xs,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  };

  const renderActions = () => {
    if (job.status === 'pending' || job.status === 'active') {
      return (
        <AppTooltip text="Cancel">
          <Pressable style={btnBase} onPress={() => onCancel(job.id)}>
            <Ionicons name="close-circle" size={S.size.sm} color={$('danger' as any, theme)} />
          </Pressable>
        </AppTooltip>
      );
    }
    if (job.status === 'completed') {
      return (
        <AppTooltip text="Dismiss">
          <Pressable style={btnBase} onPress={() => onDismiss(job.id)}>
            <Ionicons name="close-circle" size={S.size.sm} color={$('textSecondary' as any, theme)} />
          </Pressable>
        </AppTooltip>
      );
    }
    // error → Retry + Dismiss
    return (
      <View style={{ flexDirection: 'row' }}>
        <AppTooltip text="Retry">
          <Pressable
            style={[btnBase, { backgroundColor: $('danger' as any, theme) + '22' }]}
            onPress={() => onRetry(job.id)}
          >
            <Ionicons name="refresh" size={S.size.sm - 3} color={$('danger' as any, theme)} />
          </Pressable>
        </AppTooltip>
        <AppTooltip text="Dismiss">
          <Pressable style={btnBase} onPress={() => onDismiss(job.id)}>
            <Ionicons name="close-circle" size={S.size.sm} color={$('textSecondary' as any, theme)} />
          </Pressable>
        </AppTooltip>
      </View>
    );
  };

  // ── Row ────────────────────────────────────────────────
  const row = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: S.space.xs,
        paddingRight: S.space.xs,
        borderLeftWidth: 3,
        borderLeftColor: typeColor,
        paddingLeft: S.space.sm,
        gap: S.space.xs,
      }}
    >
      <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
        {renderStatusIcon()}
      </View>

      <Body fontSize={S.font.body1 * 0.8} numberOfLines={1} style={{ flex: 1 }}>
        {job.title}
      </Body>

      {renderActions()}
    </View>
  );

  // Wrap with tooltip on error so full error text shows on hover
  if (job.status === 'error' && job.error) {
    return (
      <AppTooltip text={job.error} enableMobilePress>
        {row}
      </AppTooltip>
    );
  }

  return row;
}
