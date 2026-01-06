import { AppPage, Body, Title } from '@/components/ui';

export default function CharacterSheetsPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Character Sheets
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Manage your partys character sheets and track character progression.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🎭 Coming Soon: Character sheet builder, stat tracking, and level progression tools.
      </Body>
    </AppPage>
  );
}
