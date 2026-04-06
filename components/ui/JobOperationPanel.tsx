/**
 * JobOperationPanel
 *
 * Google Drive-style job operation accordion anchored to the bottom-right.
 * Header at top, items below. Bottom-anchored so the header rises as items appear.
 * The layer (JobOperationLayer) owns positioning, z-index, and enter/exit fade.
 */

import { useJobOperationContext } from '@/providers/JobOperationProvider';
import { $, useScale, UseTheme } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';
import { Accordion } from './Accordion';
import { AppTooltip } from './AppToolTip';
import { JobOperationItem } from './JobOperationItem';
import { getShadowStyle } from './Resuables/shadows';

const MAX_VISIBLE_ITEMS = 4;

export function JobOperationPanel() {
  const S = useScale();
  const { theme } = UseTheme();
  const { jobs, isExpanded, activeCount, setExpanded, cancelJob, dismissJob, dismissAll, removeJob } =
    useJobOperationContext();

  const handleToggle = () => setExpanded(!isExpanded);

  const handleRetry = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (job?.onRetry) void Promise.resolve(job.onRetry());
    removeJob(id);
  };

  const allDone = activeCount === 0;
  const headerLabel =
    !allDone
      ? `Operations (${jobs.length})`
      : `Operations — Done (${jobs.length})`;

  // When all jobs are done, replace the +/- with a dismiss-all button
  const headerRight = allDone ? (
    <AppTooltip text="Dismiss all">
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          dismissAll();
        }}
        style={{
          padding: S.space.xxs ?? 2,
          borderRadius: S.radius.sm,
        }}
      >
        <Ionicons name="close-circle" size={S.size.md} color={$('textSecondary' as any, theme)} />
      </Pressable>
    </AppTooltip>
  ) : undefined;

  const jobList = jobs.map((job) => (
    <JobOperationItem
      key={job.id}
      job={job}
      onCancel={cancelJob}
      onDismiss={dismissJob}
      onRetry={handleRetry}
    />
  ));

  const content =
    jobs.length > MAX_VISIBLE_ITEMS ? (
      <ScrollView style={{ maxHeight: S.size.lg * 6 }} showsVerticalScrollIndicator={false}>
        {jobList}
      </ScrollView>
    ) : (
      <View>{jobList}</View>
    );

  return (
    <Accordion
      title={headerLabel}
      open={isExpanded}
      onToggle={handleToggle}
      bordered={false}
      headerRight={headerRight}
      style={{ marginBottom: 0, ...getShadowStyle('combined') }}
    >
      {content}
    </Accordion>
  );
}

