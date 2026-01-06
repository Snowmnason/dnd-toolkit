import { AppPage, Body, Title } from '@/components/ui';

export default function NPCForgePage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        NPC Forge
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Create memorable NPCs with personalities, stats, and backstories.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        🧙 Coming Soon: NPC generator, personality traits, and stat blocks.
      </Body>
    </AppPage>
  );
}
