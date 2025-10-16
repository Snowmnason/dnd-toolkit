import { useRouter } from 'expo-router';
import { Button, Heading, View } from 'tamagui';
// import { ComponentStyles } from '../../constants/theme'; // deprecated
import { useAppParams } from '../../contexts/AppParamsContext';
import { PanelConfig } from './PanelData';

interface PanelViewProps {
  config: PanelConfig;
  userId?: string;
  worldId?: string;
  userRole?: string;
  style?: any;
}

export function PanelView({ config, userId, worldId, userRole, style }: PanelViewProps) {
  const router = useRouter();
  const { updateParams } = useAppParams();
  // const styles = ComponentStyles.panelView; // deprecated

  const navigateToFeature = (featurePath: string) => {
    // Update centralized params context before navigation
    updateParams({
      userId,
      worldId,
      userRole,
    });

    const routeParams: any = {};
    if (userId) routeParams.userId = userId;
    if (worldId) routeParams.worldId = worldId;
    if (userRole) routeParams.userRole = userRole;
    router.push({
      pathname: `/main/${featurePath}` as any,
      params: routeParams,
    });
  };

  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', padding: 16, borderRadius: 8, borderWidth: 1 }, style]}>
      <View style={{ width: '100%', flex: 1, justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Heading>{config.title}</Heading>
      </View>
      {/* Feature Buttons */}
      <View style={{ width: '100%', flex: 10, alignItems: 'center', justifyContent: 'center' }}>
        {config.items.map((item, index) => (
          <Button
            key={index}
            style={{ width: '90%', borderRadius: 8, borderWidth: 2, marginBottom: 8 }}
            onPress={() => navigateToFeature(item.route)}
          >
            {item.name}
          </Button>
        ))}
      </View>
    </View>
  );
}
