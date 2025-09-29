import { Text, View } from 'react-native';

export default function MainScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: '#b14343ff' }}>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', borderColor: 'black', borderWidth: 2, height: '100%' }}>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 36 }}> Characters & NPC </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Character Sheets </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Party Overview </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> NPC Forge </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Faction Tracker </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', borderColor: 'black', borderWidth: 2, height: '100%' }}>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 36 }}> Items & Treasure </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Inventory </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Party Loot </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Treasure Generator </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Shop Generator </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', borderColor: 'black', borderWidth: 2, height: '100%'  }}> 
        <Text style={{ fontWeight: 'bold', fontFamily: 'imperal', fontSize: 36 }}> World & Exploration </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Dungeon/Town Creator </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Battle Map Maker </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> World Map </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Weather Generator </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', borderColor: 'black', borderWidth: 2, height: '100%' }}>
        <Text style={{ fontWeight: 'bold', fontFamily: 'Grenze Gotisch', fontSize: 36 }}> Combat & Events </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Encounter Builder </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Initiative Tracker </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Event Builder </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Calendar </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', borderColor: 'black', borderWidth: 2, height: '100%' }}>
        <Text style={{ fontWeight: 'bold', fontFamily: 'Grenze Gotisch', fontSize: 36 }}> Story & Notes </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Quest Log </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Journal </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Notes  </Text>
        <Text style={{ fontWeight: 'bold', fontFamily: 'helvetica', fontSize: 26 }}> Handouts </Text>
      </View>
      </View>
  );
}
