import { AppPage, Body, Title } from '@/components/ui';

export default function CalendarPage() {
  return (
    <AppPage 
      style={{ flex: 1, padding: 20 }}
      contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Title style={{ marginBottom: 20 }}>
        Calendar
      </Title>
      <Body style={{ marginBottom: 40, textAlign: 'center', fontSize: 18 }}>
        Track in-world time and schedule campaign events.
      </Body>
      
      {/* Placeholder content */}
      <Body style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 40 }}>
        📅 Coming Soon: Custom calendars, event scheduling, and time tracking.
      </Body>
    </AppPage>
  );
}
