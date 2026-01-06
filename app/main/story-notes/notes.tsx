import { AppPage, Body, Title } from '@/components/ui';

export default function NotesPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Notes
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Keep quick notes and reminders for your campaign.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📝 Coming Soon: Quick notes, tags, and search functionality.
      </Body>
    </AppPage>
  );
}
