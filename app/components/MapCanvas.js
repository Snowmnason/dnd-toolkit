import { Text, TouchableOpacity, View } from 'react-native';
import styles from '../homescreen/HomeScreen.styles';

export default function MapCanvas() {
  return (
    <>
      <View style={{ flex: 1, backgroundColor: '#222', borderRadius: 12, margin: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#888' }}>[Map Canvas Area]</Text>
      </View>
      {/* Floating panel for pen icons */}
      <View style={{ position: 'absolute', bottom: 32, left: 32, right: 32, backgroundColor: '#333', borderRadius: 24, flexDirection: 'row', justifyContent: 'space-around', padding: 16, zIndex: 10 }}>
          {/* Placeholder icons */}
          <Text style={{ color: '#fff', fontSize: 24 }}>🖊️</Text>
          <Text style={{ color: '#fff', fontSize: 24 }}>🖌️</Text>
          <Text style={{ color: '#fff', fontSize: 24 }}>🗺️</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', margin: 24 }}>
            <TouchableOpacity style={[styles.createButton, { width: '80%' }]}>
              <Text style={styles.createButtonText}>Import Image</Text>
            </TouchableOpacity>
          </View>
    </>
  );
}
