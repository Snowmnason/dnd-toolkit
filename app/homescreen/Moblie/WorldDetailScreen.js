import { Image, Text, View } from 'react-native';
import IconButton from '../../components/IconButton';
import PrimaryButton from '../../components/PrimaryButton';
import styles from '../HomeScreen.styles';

export default function WorldDetailScreen({ route, navigation }) {
  const { worldName } = route.params;
  let selectedMapImage = require('../../../assets/images/Miku.png');

  return (  
    <View style={styles.rightPanelMoblie}>
      {/* Back Button TODO: can be done better */}
      <IconButton
        icon="⬅️"
        onPress={() => navigation.goBack()}
        style={{ position: 'absolute', top: 36, left: 16, zIndex: 10, backgroundColor: 'transparent' }}
        textStyle={{ color: '#fff', fontSize: 24 }}
      />
      <Text style={[styles.selectedWorldTitle, { marginTop: 32 }]}>{worldName}</Text>
      <View style={styles.rightButtonsContainerMoblie}>
        <PrimaryButton
          onPress={() => {/* handle create */}}
        >
          Delete
        </PrimaryButton>
        <PrimaryButton
          onPress={() => {navigation.reset({index: 0, routes: [{ name: 'Main' }]})}}
        >
          Open
        </PrimaryButton>
      </View>
      <Image
        source={selectedMapImage}
        style={styles.mapImage}
        resizeMode="contain"
      />
    </View>
  );
}
