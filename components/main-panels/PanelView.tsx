import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ComponentStyles } from '../../constants/theme';
import { useAppParams } from '../../contexts/AppParamsContext';
import PrimaryButton from '../custom_components/PrimaryButton';
import { ThemedText } from '../themed-text';
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
  const styles = ComponentStyles.panelView;

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
    <View style={[styles.panel, style]}>
        <View style={{ flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, flex: 1, width: '100%' }}>
            <ThemedText type="title" style={styles.panelTitle}>
                {config.title}
            </ThemedText>
        </View>
        {/* Feature Buttons */}
        <View style={{ flexDirection: 'column', alignItems: 'center', flex: 10, justifyContent: 'center', width: '100%' }}>
        {config.items.map((item, index) => (
            <PrimaryButton
            key={index}
            style={styles.featureButton}
            textStyle={styles.featureText}
            onPress={() => navigateToFeature(item.route)}
            >
            {item.name}
            </PrimaryButton>
        ))}
      </View>
    </View>
  );
}
