import { AppPage, Body, Title } from '@/components/ui';

export default function QuestLogPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
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
    </AppPage>
  );
}
