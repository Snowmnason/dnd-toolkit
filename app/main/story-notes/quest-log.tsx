import { AppView, Body, Title } from '@/components/ui';

export default function QuestLogPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Quest Log
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track active quests, objectives, and campaign progression.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📜 Coming Soon: Quest tracking, objective management, and progress visualization.
      </Body>
    </AppView>
  );
}
