import { StyleSheet } from 'react-native';

// --- Shared base styles ---
const titleText = {
  fontSize: 22,
  fontWeight: 'bold',
  color: '#ffffffff',
};

const worldItem = {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    elevation: 1,
    alignItems: 'center',
  };

// --- Component styles ---
const homeScreenStyles = StyleSheet.create({

  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2d1f03ff',
    minHeight: 0,
  },
  containerMobile: {
    paddingTop: 52,
    paddingHorizontal: 16,
    flex: 1,
    backgroundColor: '#2d1f03ff',
  },
  leftPanel: {
    flex: 1,
    padding: 14,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    position: 'relative',
    minWidth: 100,
    maxWidth: 400,
  },
  rightPanel: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    minWidth: 0,
  },
  rightPanelMoblie: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    minWidth: 0,
  },
  mapImage: {
    width: '100%',
    height: '100%',
    maxWidth: '500',
    borderRadius: 0,
    backgroundColor: '#2d1f03ff',
  },
  worldListTitle: {
    ...titleText,
    textAlign: 'center',
    marginBottom: 16,
  },
  worldListTitleMobile: {
    ...titleText,
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  worldList: {
    flex: 1,
    marginBottom: 64,
  },
  worldItem: {
    ...worldItem,
    backgroundColor: '#000000ff',
  },
  worldItemText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#920000ff',
  },
  selectedWorldItem: {
    ...worldItem,
    backgroundColor: '#c1c1d3ff',
  },
  selectedWorldTitle: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    zIndex: 2,
  },
  rightButtonsContainer: {
    position: 'absolute',
    bottom: 44,
    right: 54,
    left: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  rightButtonWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rightButtonsContainerMoblie: {
    position: 'absolute',
    bottom: 44,
    right: 24,
    left: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },

});

export default homeScreenStyles;
