import { AppView, Body, Title } from '@/components/ui';

export default function JournalPage() {
  return (
    <AppView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Title style={{ marginBottom: 20 }}>
        Journal
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Record campaign sessions and memorable story moments.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📖 Coming Soon: Session notes, story timeline, and campaign diary.
      </Body>
    </AppView>
  );
}
