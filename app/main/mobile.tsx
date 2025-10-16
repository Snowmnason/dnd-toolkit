import { useLocalSearchParams } from 'expo-router';
import { View } from 'tamagui';
import { panelConfigs } from '../../components/main-panels/PanelData';
import { PanelView } from '../../components/main-panels/PanelView';

export default function MainScreenMobile() {
  const params = useLocalSearchParams();
  const userId = typeof params.userId === 'string' ? params.userId : undefined;
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined;
  const tab = typeof params.tab === 'string' ? params.tab : 'characters';

  // Find the active panel config based on the tab parameter
  const activePanel = panelConfigs.find(p => p.key === tab) || panelConfigs[0];

  return (
    <View style={{ flex: 1 }}>
      <PanelView
        config={activePanel}
        userId={userId}
        worldId={worldId}
        userRole={userRole}
      />
    </View>
  );
}
