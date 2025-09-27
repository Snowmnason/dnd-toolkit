import { Image, Text, TouchableOpacity, View } from 'react-native';
import styles from '../HomeScreen.styles';

export default function WorldDetailScreen({ route, navigation }) {
  const { worldName } = route.params;
  let selectedMapImage = require('../../../assets/images/Miku.png');

  return (
    <View style={styles.rightPanel}>
      <Text style={styles.selectedWorldTitle}>{worldName}</Text>
      <View style={styles.rightButtonsContainer}>
        <View style={styles.leftButtonWrapper}>
          <TouchableOpacity style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.rightButtonWrapper}>
          <TouchableOpacity style={styles.openButton}>
            <Text style={styles.openButtonText}>Open</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Image
        source={selectedMapImage}
        style={styles.mapImage}
        resizeMode="contain"
      />
    </View>
  );
}
