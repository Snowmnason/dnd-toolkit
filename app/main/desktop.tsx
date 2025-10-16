import { useLocalSearchParams } from 'expo-router';
import { View } from 'tamagui';
import { panelConfigs } from '../../components/main-panels/PanelData';
import { PanelView } from '../../components/main-panels/PanelView';

export default function MainScreenDesktop() {
  const params = useLocalSearchParams();
  const userId = typeof params.userId === 'string' ? params.userId : undefined;
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined;

  return (
    <View style={{ flexDirection: 'row', flex: 1 }}>
      {panelConfigs.map((panel) => (
        <PanelView
          key={panel.key}
          config={panel}
          userId={userId}
          worldId={worldId}
          userRole={userRole}
        />
      ))}
    </View>
  );
}
