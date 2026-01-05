import { AppPage, Body, Title } from '@/components/ui';

export default function NPCForgePage() {
  return (
    <AppPage style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
