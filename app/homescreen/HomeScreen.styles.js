import { StyleSheet } from 'react-native';

// --- Shared base styles ---
const buttonBase = {
  backgroundColor: '#1976d2',
  paddingVertical: 12,
  borderRadius: 16,
  elevation: 2,
  alignItems: 'center',
};

const buttonTextBase = {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
};

const titleText = {
  fontSize: 22,
  fontWeight: 'bold',
  color: '#ffffffff',
};

const worldItemText = {
  fontWeight: 'bold',
  fontSize: 18,
  color: '#920000ff',
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
  worldList: {
    flex: 1,
    marginBottom: 64,
  },
  worldItem: {
    ...worldItem,
    backgroundColor: '#000000ff',
  },
  worldItemText: {
    ...worldItemText,
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
  leftButtonWrapper: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rightButtonWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  createButton: {
    ...buttonBase,
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 14,
  },
  createButtonText: {
    ...buttonTextBase,
  },
  openButton: {
    ...buttonBase,
    paddingHorizontal: 20,
    marginLeft: 8,
  },
  openButtonText: {
    ...buttonTextBase,
  },
  deleteButton: {
    ...buttonBase,
    paddingHorizontal: 20,
  },
  deleteButtonText: {
    ...buttonTextBase,
  },
});

export default homeScreenStyles;
