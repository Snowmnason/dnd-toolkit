import React, { createContext, useContext, useState } from 'react';

interface WorldSelectionContextType {
  selectedWorld: string | null;
  setSelectedWorld: (world: string | null) => void;
  handleBackPress: () => void;
}

const WorldSelectionContext = createContext<WorldSelectionContextType | undefined>(undefined);

export function WorldSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);

  const handleBackPress = () => {
    if (selectedWorld) {
      // If a world is selected, go back to world list
      setSelectedWorld(null);
      return true; // Indicate we handled the back press
    }
    return false; // Let default back behavior happen
  };

  return (
    <WorldSelectionContext.Provider value={{
      selectedWorld,
      setSelectedWorld,
      handleBackPress,
    }}>
      {children}
    </WorldSelectionContext.Provider>
  );
}

export function useWorldSelection() {
  const context = useContext(WorldSelectionContext);
  if (context === undefined) {
    throw new Error('useWorldSelection must be used within a WorldSelectionProvider');
  }
  return context;
}